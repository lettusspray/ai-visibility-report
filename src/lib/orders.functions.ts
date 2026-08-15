import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { TIERS } from "./types";

const intakeSchema = z.object({
  tier: z.enum(["standard", "whitelabel"]),
  email: z.string().trim().email().max(255),
  brandName: z.string().trim().min(1).max(120),
  brandWebsite: z.string().trim().min(3).max(200),
  industry: z.string().trim().min(2).max(160),
  targetCustomer: z.string().trim().min(10).max(1500),
  competitors: z.array(z.string().trim().min(1).max(120)).min(2).max(3),
  agencyName: z.string().trim().max(120).optional(),
  logoBase64: z.string().max(3_000_000).optional(),
  logoType: z.string().max(60).optional(),
  origin: z.string().trim().url().max(300),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => intakeSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createCheckoutSession } = await import("./stripe.server");
    const tier = TIERS[data.tier];

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        email: data.email,
        tier: data.tier,
        amount_cents: tier.price,
        brand_name: data.brandName,
        brand_website: data.brandWebsite,
        industry: data.industry,
        target_customer: data.targetCustomer,
        competitors: data.competitors,
        agency_name: data.tier === "whitelabel" ? (data.agencyName ?? null) : null,
      })
      .select("id, access_token")
      .single();
    if (error || !order) throw new Error(error?.message ?? "Could not create order");

    if (data.tier === "whitelabel" && data.logoBase64 && data.logoType) {
      try {
        const ext = data.logoType.includes("png") ? "png" : "jpg";
        const bytes = Uint8Array.from(atob(data.logoBase64), (c) => c.charCodeAt(0));
        const path = `${order.id}/logo.${ext}`;
        const up = await supabaseAdmin.storage
          .from("logos")
          .upload(path, bytes, { contentType: data.logoType, upsert: true });
        if (!up.error) {
          await supabaseAdmin.from("orders").update({ agency_logo_path: path }).eq("id", order.id);
        }
      } catch {
        /* logo is optional */
      }
    }

    const session = await createCheckoutSession({
      email: data.email,
      orderId: order.id,
      productName: `${tier.name} — AI Search Visibility Report`,
      amountCents: tier.price,
      successUrl: `${data.origin}/status/${order.access_token}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${data.origin}/buy?tier=${data.tier}&canceled=1`,
    });

    await supabaseAdmin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

    return { checkoutUrl: session.url, token: order.access_token as string };
  });

export const confirmAndStart = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().uuid(), sessionId: z.string().max(300).optional(), origin: z.string().url() }).parse(
      data,
    ),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getCheckoutSession } = await import("./stripe.server");
    const { generateReportForOrder } = await import("./report.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, status, stripe_session_id")
      .eq("access_token", data.token)
      .single();
    if (!order) throw new Error("Order not found");

    if (order.payment_status !== "paid") {
      const sessionId = data.sessionId ?? order.stripe_session_id;
      if (!sessionId) return { started: false, reason: "unpaid" as const };
      const session = await getCheckoutSession(sessionId);
      if (!session.paid) return { started: false, reason: "unpaid" as const };
      await supabaseAdmin.from("orders").update({ payment_status: "paid" }).eq("id", order.id);
    }

    if (order.status === "complete" || order.status === "processing") {
      return { started: false, reason: "already" as const };
    }

    await supabaseAdmin.from("orders").update({ status: "processing" }).eq("id", order.id);
    void generateReportForOrder(order.id, data.origin).catch((error) => console.error(error));
    return { started: true, reason: "started" as const };
  });

export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id, brand_name, tier, status, payment_status, progress_message, error_message, email, email_sent, report_json, report_path, competitors, industry, created_at",
      )
      .eq("access_token", data.token)
      .single();
    if (!order) throw new Error("Report not found");

    let downloadUrl: string | null = null;
    if (order.report_path) {
      const signed = await supabaseAdmin.storage.from("reports").createSignedUrl(order.report_path, 60 * 60);
      downloadUrl = signed.data?.signedUrl ?? null;
    }
    return { ...order, downloadUrl };
  });

const adminSchema = z.object({ password: z.string().min(1).max(200) });

function checkAdmin(password: string) {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) throw new Error("Admin password is not configured.");
  if (password !== expected) throw new Error("Incorrect password.");
}

export const adminListOrders = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => adminSchema.parse(data))
  .handler(async ({ data }) => {
    checkAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, created_at, email, brand_name, tier, amount_cents, payment_status, status, progress_message, error_message, access_token, email_sent",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return orders ?? [];
  });

export const adminRegenerate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    adminSchema.extend({ orderId: z.string().uuid(), origin: z.string().url() }).parse(data),
  )
  .handler(async ({ data }) => {
    checkAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateReportForOrder } = await import("./report.server");
    await supabaseAdmin
      .from("orders")
      .update({ status: "processing", error_message: null, progress_message: "Restarting generation" })
      .eq("id", data.orderId);
    void generateReportForOrder(data.orderId, data.origin).catch((error) => console.error(error));
    return { ok: true };
  });

export const adminMarkPaidAndStart = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    adminSchema.extend({ orderId: z.string().uuid(), origin: z.string().url() }).parse(data),
  )
  .handler(async ({ data }) => {
    checkAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateReportForOrder } = await import("./report.server");
    await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid", status: "processing", error_message: null })
      .eq("id", data.orderId);
    void generateReportForOrder(data.orderId, data.origin).catch((error) => console.error(error));
    return { ok: true };
  });