import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { PLANS, planOf } from "./types";

const brandSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  website: z.string().min(1).max(200),
  industry: z.string().min(1).max(200),
  targetCustomer: z.string().min(1).max(2000),
  competitors: z.array(z.string().max(120)).max(5),
  agencyName: z.string().max(120).nullable().optional(),
});

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export const getMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims["email"] as string | undefined) ?? "";

    let { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) {
      const { data: created } = await supabase
        .from("profiles")
        .insert({ id: userId, email })
        .select("*")
        .single();
      profile = created;
    }
    if (profile && profile.usage_period_start !== monthStart()) {
      const { data: reset } = await supabase
        .from("profiles")
        .update({ usage_period_start: monthStart(), reports_this_period: 0 })
        .eq("id", userId)
        .select("*")
        .single();
      profile = reset ?? profile;
    }

    const { data: brands } = await supabase
      .from("brands")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    return {
      profile: profile
        ? {
            id: profile.id,
            email: profile.email,
            plan: profile.plan,
            subscriptionStatus: profile.subscription_status,
            currentPeriodEnd: profile.current_period_end,
            reportsThisPeriod: profile.reports_this_period,
            hasSubscription: Boolean(profile.paystack_subscription_code),
          }
        : null,
      brands: brands ?? [],
    };
  });

export const saveBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => brandSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      user_id: userId,
      name: data.name,
      website: data.website,
      industry: data.industry,
      target_customer: data.targetCustomer,
      competitors: data.competitors.filter((c) => c.trim().length > 0),
      agency_name: data.agencyName ?? null,
    };
    if (data.id) {
      const { data: updated, error } = await supabase
        .from("brands")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: created, error } = await supabase.from("brands").insert(row).select("*").single();
    if (error) throw new Error(error.message);
    return created;
  });

export const listQueries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ brandId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("tracked_queries")
      .select("*")
      .eq("brand_id", data.brandId)
      .order("created_at", { ascending: true });
    return rows ?? [];
  });

export const addCustomQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        brandId: z.string().uuid(),
        question: z.string().min(6).max(300),
        region: z.string().max(80).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("plan").eq("id", userId).single();
    const plan = planOf(profile?.plan);
    if (!plan.customQuestions) throw new Error("Custom questions are available on Starter and Pro.");

    const { count } = await supabase
      .from("tracked_queries")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", data.brandId);
    if ((count ?? 0) >= plan.maxQuestions) throw new Error(`This brand already tracks ${plan.maxQuestions} questions.`);

    const { data: created, error } = await supabase
      .from("tracked_queries")
      .insert({
        brand_id: data.brandId,
        user_id: userId,
        question: data.question,
        region: data.region?.trim() || null,
        source: "custom",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const removeQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase.from("tracked_queries").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const startSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ brandId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, reports_this_period, usage_period_start")
      .eq("id", userId)
      .single();
    const plan = planOf(profile?.plan);
    const used = profile?.usage_period_start === monthStart() ? (profile?.reports_this_period ?? 0) : 0;

    if (plan.id === "free" && used >= plan.reportsPerMonth) {
      throw new Error("Your free plan includes one report a month. Upgrade to Starter for unlimited reports.");
    }
    if (plan.id !== "free" && used >= plan.softCapPerMonth) {
      throw new Error("You have hit an unusually high number of reports this month. Contact us to lift the limit.");
    }

    const { data: running } = await supabase
      .from("snapshots")
      .select("id")
      .eq("brand_id", data.brandId)
      .in("status", ["pending", "processing"])
      .limit(1);
    if (running && running.length > 0) return { snapshotId: running[0]!.id, alreadyRunning: true };

    const { data: snap, error } = await supabase
      .from("snapshots")
      .insert({ brand_id: data.brandId, user_id: userId, status: "pending" })
      .select("id")
      .single();
    if (error || !snap) throw new Error(error?.message ?? "Could not start a snapshot.");

    await supabase
      .from("profiles")
      .update({ usage_period_start: monthStart(), reports_this_period: used + 1 })
      .eq("id", userId);

    const { runSnapshot } = await import("./snapshot.server");
    void runSnapshot(snap.id).catch((err) => console.error("snapshot failed", err));

    return { snapshotId: snap.id, alreadyRunning: false };
  });

export const listSnapshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ brandId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("snapshots")
      .select("id, status, progress_message, report_json, brand_visibility, competitor_visibility, platform_stats, question_count, created_at, completed_at, error_message, access_token")
      .eq("brand_id", data.brandId)
      .order("created_at", { ascending: false })
      .limit(60);
    return rows ?? [];
  });

export const getSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: snap } = await context.supabase.from("snapshots").select("*").eq("id", data.id).single();
    if (!snap) throw new Error("Snapshot not found");
    let pdfUrl: string | null = null;
    if (snap.report_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const signed = await supabaseAdmin.storage.from("reports").createSignedUrl(snap.report_path, 60 * 60);
      pdfUrl = signed.data?.signedUrl ?? null;
    }
    return { snapshot: snap, pdfUrl };
  });

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ plan: z.enum(["starter", "pro"]), origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
    const email = profile?.email || (claims["email"] as string | undefined) || "";
    if (!email) throw new Error("Your account has no email address.");

    const { initializeSubscription } = await import("./paystack.server");
    const result = await initializeSubscription({
      email,
      amountUsd: PLANS[data.plan].priceUsd,
      plan: data.plan,
      userId,
      callbackUrl: `${data.origin}/billing/callback`,
    });
    return { url: result.authorization_url };
  });

export const confirmCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reference: z.string().min(4).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { verifyTransaction, findSubscription } = await import("./paystack.server");
    const tx = await verifyTransaction(data.reference);
    if (tx.status !== "success") return { ok: false, plan: null };

    const plan = tx.metadata?.plan === "pro" ? "pro" : "starter";
    const customerCode = tx.customer?.customer_code ?? null;
    const sub = customerCode ? await findSubscription(customerCode).catch(() => null) : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({
        plan,
        subscription_status: sub?.status ?? "active",
        paystack_customer_code: customerCode,
        paystack_subscription_code: sub?.subscription_code ?? null,
        paystack_email_token: sub?.email_token ?? null,
        current_period_end: sub?.next_payment_date ?? null,
      })
      .eq("id", userId);

    return { ok: true, plan };
  });

export const getBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("paystack_subscription_code")
      .eq("id", context.userId)
      .single();
    if (!profile?.paystack_subscription_code) throw new Error("No active subscription to manage.");
    const { manageLink } = await import("./paystack.server");
    return { url: await manageLink(profile.paystack_subscription_code) };
  });
