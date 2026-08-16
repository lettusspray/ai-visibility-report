import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function assertAdmin(password: string) {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) throw new Error("Admin password is not configured.");
  if (password !== expected) throw new Error("Incorrect password.");
}

export const adminOverview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, plan, subscription_status, current_period_end, reports_this_period, created_at")
      .order("created_at", { ascending: false })
      .limit(300);

    const { data: snapshots } = await supabaseAdmin
      .from("snapshots")
      .select("id, user_id, brand_id, status, brand_visibility, created_at, error_message")
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: brands } = await supabaseAdmin.from("brands").select("id, user_id, name");

    const counts = new Map<string, number>();
    for (const s of snapshots ?? []) counts.set(s.user_id, (counts.get(s.user_id) ?? 0) + 1);

    return {
      totals: {
        accounts: profiles?.length ?? 0,
        paid: (profiles ?? []).filter((p) => p.plan !== "free").length,
        snapshots: snapshots?.length ?? 0,
      },
      accounts: (profiles ?? []).map((p) => ({
        ...p,
        brands: (brands ?? []).filter((b) => b.user_id === p.id).map((b) => b.name),
        recentSnapshots: counts.get(p.id) ?? 0,
      })),
      snapshots: (snapshots ?? []).map((s) => ({
        ...s,
        brandName: (brands ?? []).find((b) => b.id === s.brand_id)?.name ?? "—",
      })),
    };
  });

export const adminRegenerate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string().min(1).max(200), snapshotId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { runSnapshot } = await import("./snapshot.server");
    void runSnapshot(data.snapshotId).catch((err) => console.error("regenerate failed", err));
    return { ok: true };
  });
