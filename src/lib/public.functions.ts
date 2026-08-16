import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Shared snapshot view. The access token is the credential; nothing else is exposed. */
export const getSharedSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: snap } = await supabaseAdmin
      .from("snapshots")
      .select("id, status, brand_id, report_json, brand_visibility, competitor_visibility, platform_stats, report_path, created_at, question_count")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!snap) return null;

    const { data: brand } = await supabaseAdmin
      .from("brands")
      .select("name, website, industry, agency_name")
      .eq("id", snap.brand_id)
      .maybeSingle();

    let pdfUrl: string | null = null;
    if (snap.report_path) {
      const signed = await supabaseAdmin.storage.from("reports").createSignedUrl(snap.report_path, 60 * 60);
      pdfUrl = signed.data?.signedUrl ?? null;
    }

    return {
      status: snap.status,
      createdAt: snap.created_at,
      questionCount: snap.question_count,
      brand: brand ? { name: brand.name, website: brand.website, agencyName: brand.agency_name } : null,
      report: snap.report_json,
      pdfUrl,
    };
  });
