function key(): string {
  const k = process.env["STRIPE_SECRET_KEY"];
  if (!k) {
    throw new Error(
      "Payments are not configured yet. Add STRIPE_SECRET_KEY (test mode) in Project Settings → Secrets.",
    );
  }
  return k;
}

async function stripe(path: string, body?: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${key()}`,
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json["error"] as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe request failed (${res.status})`);
  }
  return json;
}

export async function createCheckoutSession(input: {
  email: string;
  orderId: string;
  productName: string;
  amountCents: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; id: string }> {
  const session = await stripe("checkout/sessions", {
    mode: "payment",
    "payment_method_types[0]": "card",
    customer_email: input.email,
    client_reference_id: input.orderId,
    "metadata[order_id]": input.orderId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(input.amountCents),
    "line_items[0][price_data][product_data][name]": input.productName,
    "line_items[0][price_data][product_data][description]":
      "One-time AI Search Visibility Report, delivered as a PDF.",
  });
  return { url: String(session["url"]), id: String(session["id"]) };
}

export async function getCheckoutSession(
  sessionId: string,
): Promise<{ paid: boolean; orderId: string | undefined }> {
  const session = await stripe(`checkout/sessions/${sessionId}`);
  return {
    paid: session["payment_status"] === "paid",
    orderId: (session["client_reference_id"] as string | null) ?? undefined,
  };
}

export function paymentsConfigured(): boolean {
  return Boolean(process.env["STRIPE_SECRET_KEY"]);
}