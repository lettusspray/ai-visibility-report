const API = "https://api.paystack.co";

function secret(): string {
  const key = process.env["PAYSTACK_SECRET_KEY"];
  if (!key) throw new Error("Paystack is not configured yet. Add PAYSTACK_SECRET_KEY in project secrets.");
  return key;
}

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${secret()}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as { status?: boolean; message?: string; data?: T };
  if (!res.ok || json.status === false) throw new Error(json.message || `Paystack ${res.status}`);
  return json.data as T;
}

export function planCode(plan: "starter" | "pro"): string | null {
  return (plan === "starter" ? process.env["PAYSTACK_PLAN_STARTER"] : process.env["PAYSTACK_PLAN_PRO"]) ?? null;
}

/** USD only — we deliberately do not attempt per-country pricing. */
export async function initializeSubscription(input: {
  email: string;
  amountUsd: number;
  plan: "starter" | "pro";
  userId: string;
  callbackUrl: string;
}): Promise<{ authorization_url: string; reference: string }> {
  const code = planCode(input.plan);
  return paystack("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountUsd * 100),
      currency: "USD",
      ...(code ? { plan: code } : {}),
      callback_url: input.callbackUrl,
      metadata: { user_id: input.userId, plan: input.plan },
    }),
  });
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  customer?: { customer_code?: string; email?: string };
  plan_object?: { plan_code?: string };
  metadata?: { user_id?: string; plan?: string };
  paidAt?: string;
}> {
  return paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export async function findSubscription(customerCode: string): Promise<
  { subscription_code?: string; email_token?: string; status?: string; next_payment_date?: string } | null
> {
  const list = await paystack<{ subscription_code: string; email_token: string; status: string; next_payment_date: string }[]>(
    `/subscription?customer=${encodeURIComponent(customerCode)}`,
  );
  return list?.[0] ?? null;
}

export async function manageLink(subscriptionCode: string): Promise<string> {
  const data = await paystack<{ link: string }>(`/subscription/${encodeURIComponent(subscriptionCode)}/manage/link`);
  return data.link;
}

export async function disableSubscription(code: string, emailToken: string): Promise<void> {
  await paystack("/subscription/disable", {
    method: "POST",
    body: JSON.stringify({ code, token: emailToken }),
  });
}

/** Paystack signs webhooks with HMAC SHA512 of the raw body using the secret key. */
export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-512" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i += 1) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
