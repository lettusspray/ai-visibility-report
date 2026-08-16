import { activeEngines, callAI, parseJsonLoose, type Msg } from "./ai.server";
import { renderReportPdf } from "./pdf.server";
import { planOf, type PlanDef, type QueryResult, type ReportData } from "./types";

const QUESTION_MODEL = "openai/gpt-5-mini";
const ANALYSIS_MODEL = "openai/gpt-5";
const EDITOR_MODEL = "openai/gpt-5-mini";

export type BrandRow = {
  id: string;
  user_id: string;
  name: string;
  website: string;
  industry: string;
  target_customer: string;
  competitors: string[];
  agency_name: string | null;
};

export type TrackedQuery = { id: string; question: string; region: string | null; source: string };

function mentions(answer: string, name: string): boolean {
  const haystack = answer.toLowerCase();
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  const core = needle.replace(/\b(inc|llc|ltd|co|corp|group|agency|studio)\b\.?/g, "").trim();
  const bare = core.replace(/\.(com|io|co|net|ai|org)$/i, "").trim();
  return bare.length > 2 && haystack.includes(bare);
}

function citesDomain(answer: string, website: string): boolean {
  const domain = website
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  return Boolean(domain) && answer.toLowerCase().includes(domain!);
}

export async function generateBaseQuestions(brand: BrandRow, count: number): Promise<string[]> {
  const raw = await callAI(QUESTION_MODEL, [
    {
      role: "system",
      content:
        "You generate realistic buyer-intent questions real people type into AI assistants when shopping. Respond with a JSON array of strings only.",
    },
    {
      role: "user",
      content: `Industry / niche: ${brand.industry}
Target customer: ${brand.target_customer}

Write ${count} distinct, natural buyer-intent questions someone in this niche would ask an AI assistant while evaluating options (best-of, recommendation, comparison, pricing, "who should I use" styles). Do not mention specific brand names. Return only a JSON array of ${count} strings.`,
    },
  ], { maxTokens: 6000 });
  const questions = parseJsonLoose<string[]>(raw)
    .filter((q) => typeof q === "string" && q.trim().length > 5)
    .slice(0, count);
  if (questions.length < 3) throw new Error("Question generation returned too few questions.");
  return questions;
}

function askMessages(q: TrackedQuery): Msg[] {
  const region = q.region?.trim();
  return [
    {
      role: "system",
      content: `You are a helpful shopping assistant${
        region ? `, answering as a customer based in ${region} would expect` : ""
      }. Answer concretely, naming the specific companies, products or providers you would recommend, and include their websites where you know them. Keep it under 200 words.`,
    },
    { role: "user", content: q.question },
  ];
}

export async function runQueries(brand: BrandRow, queries: TrackedQuery[]): Promise<QueryResult[]> {
  const engines = activeEngines();
  if (engines.length === 0) throw new Error("No answer engines are configured.");
  const tasks: Promise<QueryResult>[] = [];
  for (const q of queries) {
    for (const engine of engines) {
      tasks.push(
        (async () => {
          try {
            const answer = await engine.ask(askMessages(q));
            return {
              question: q.question,
              region: q.region,
              platform: engine.label,
              answer,
              brandMentioned: mentions(answer, brand.name),
              cited: citesDomain(answer, brand.website),
              competitorsMentioned: brand.competitors.filter((c) => mentions(answer, c)),
            };
          } catch (error) {
            return {
              question: q.question,
              region: q.region,
              platform: engine.label,
              answer: "",
              brandMentioned: false,
              cited: false,
              competitorsMentioned: [],
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })(),
      );
    }
  }
  return Promise.all(tasks);
}

const pct = (hits: number, total: number) => (total === 0 ? 0 : Math.round((hits / total) * 100));

export function computeStats(brand: BrandRow, results: QueryResult[]) {
  const usable = results.filter((r) => !r.error && r.answer);
  const platforms = Array.from(new Set(usable.map((r) => r.platform)));
  return {
    usableCount: usable.length,
    citationRate: pct(usable.filter((r) => r.cited).length, usable.length),
    overall: {
      brand: pct(usable.filter((r) => r.brandMentioned).length, usable.length),
      competitors: brand.competitors.map((name) => ({
        name,
        visibility: pct(usable.filter((r) => r.competitorsMentioned.includes(name)).length, usable.length),
      })),
    },
    byPlatform: platforms.map((platform) => {
      const rows = usable.filter((r) => r.platform === platform);
      return {
        platform,
        answers: rows.length,
        brand: pct(rows.filter((r) => r.brandMentioned).length, rows.length),
        competitors: brand.competitors.map((name) => ({
          name,
          visibility: pct(rows.filter((r) => r.competitorsMentioned.includes(name)).length, rows.length),
        })),
      };
    }),
  };
}

type Stats = ReturnType<typeof computeStats>;

/** Pass 1: grounded draft that must cite the captured evidence. */
async function draftAnalysis(brand: BrandRow, results: QueryResult[], stats: Stats): Promise<ReportData> {
  const evidence = results
    .filter((r) => !r.error && r.answer)
    .map(
      (r, i) =>
        `[${i + 1}] [${r.platform}]${r.region ? ` (region: ${r.region})` : ""} Q: ${r.question}
Brand mentioned: ${r.brandMentioned ? "YES" : "NO"} | Site cited: ${r.cited ? "YES" : "NO"} | Competitors named: ${
          r.competitorsMentioned.join(", ") || "none"
        }
Answer: ${r.answer.slice(0, 700)}`,
    )
    .join("\n---\n");

  const raw = await callAI(
    ANALYSIS_MODEL,
    [
      {
        role: "system",
        content:
          "You are a senior AI-search-visibility analyst. Every claim you make must be traceable to the numbered evidence provided, referenced by footnote number in square brackets. Never invent facts, brands or numbers. Return ONLY valid JSON matching the requested shape.",
      },
      {
        role: "user",
        content: `Brand: ${brand.name} (${brand.website})
Industry: ${brand.industry}
Target customer: ${brand.target_customer}
Competitors tracked: ${brand.competitors.join(", ") || "none"}

Measured visibility (share of AI answers naming each brand):
Overall - ${brand.name}: ${stats.overall.brand}%; ${stats.overall.competitors
          .map((c) => `${c.name}: ${c.visibility}%`)
          .join("; ")}
Own-site citation rate: ${stats.citationRate}%
${stats.byPlatform
  .map(
    (p) =>
      `${p.platform} (${p.answers} answers) - ${brand.name}: ${p.brand}%; ${p.competitors
        .map((c) => `${c.name}: ${c.visibility}%`)
        .join("; ")}`,
  )
  .join("\n")}

Numbered evidence:
${evidence.slice(0, 60000)}

Return JSON:
{
  "executiveSummary": "3-5 sentences quantifying the gap, with footnote numbers",
  "platforms": [{"platform":"exact platform label","summary":"2-4 sentences with footnotes","exampleExcerpts":[{"question":"...","excerpt":"verbatim excerpt, max 45 words, from an answer above"}]}],
  "whyLosing": ["4-6 diagnoses, each 2-3 sentences, each citing footnote numbers"],
  "actionItems": [{"title":"short imperative","detail":"2-4 sentences, concrete to this brand","impact":"one short line"}],
  "closingNote": "3-4 sentences on re-measuring and what good looks like in 90 days"
}
Exactly 5 action items, ordered by priority. Use only platforms present in the evidence.`,
      },
    ],
    { maxTokens: 8000 },
  );
  return normalise(parseJsonLoose(raw), brand, stats);
}

/** Pass 2: editing only. Adds no facts, strips AI-writing tells. */
async function editPass(report: ReportData): Promise<ReportData> {
  const raw = await callAI(
    EDITOR_MODEL,
    [
      {
        role: "system",
        content: `You are a line editor. You may only tighten existing text. You must not add facts, numbers, brands, claims or items, and must not remove footnote markers.
Remove: significance inflation ("crucial", "game-changing", "in today's landscape"), rule-of-three list patterns, em-dashes used as decoration, vague attributions ("studies show", "experts say"), hedging ("it seems", "arguably", "may potentially"), and chatbot closers ("I hope this helps", "In conclusion").
Prefer short declarative sentences and plain words. Keep all verbatim excerpts exactly as they are. Return the same JSON shape with the same keys and array lengths.`,
      },
      { role: "user", content: JSON.stringify(report) },
    ],
    { maxTokens: 8000 },
  );
  try {
    const edited = parseJsonLoose<ReportData>(raw);
    return {
      ...report,
      executiveSummary: edited.executiveSummary || report.executiveSummary,
      platforms: report.platforms.map((p, i) => ({
        ...p,
        summary: edited.platforms?.[i]?.summary || p.summary,
      })),
      whyLosing: edited.whyLosing?.length === report.whyLosing.length ? edited.whyLosing : report.whyLosing,
      actionItems:
        edited.actionItems?.length === report.actionItems.length
          ? report.actionItems.map((a, i) => ({
              title: edited.actionItems[i]?.title || a.title,
              detail: edited.actionItems[i]?.detail || a.detail,
              impact: edited.actionItems[i]?.impact || a.impact,
            }))
          : report.actionItems,
      closingNote: edited.closingNote || report.closingNote,
    };
  } catch {
    return report;
  }
}

function normalise(
  parsed: {
    executiveSummary?: string;
    platforms?: { platform: string; summary?: string; exampleExcerpts?: { question: string; excerpt: string }[] }[];
    whyLosing?: string[];
    actionItems?: { title: string; detail: string; impact: string }[];
    closingNote?: string;
  },
  brand: BrandRow,
  stats: Stats,
): ReportData {
  void brand;
  return {
    executiveSummary: parsed.executiveSummary ?? "",
    brandVisibility: stats.overall.brand,
    competitorVisibility: stats.overall.competitors,
    platforms: stats.byPlatform
      .filter((p) => p.answers > 0)
      .map((p) => {
        const written = parsed.platforms?.find((x) =>
          x.platform?.toLowerCase().includes(p.platform.toLowerCase()),
        );
        return {
          platform: p.platform,
          brandVisibility: p.brand,
          competitorVisibility: p.competitors,
          summary: written?.summary ?? "",
          exampleExcerpts: written?.exampleExcerpts ?? [],
        };
      }),
    whyLosing: parsed.whyLosing ?? [],
    actionItems: (parsed.actionItems ?? []).slice(0, 5),
    closingNote: parsed.closingNote ?? "",
  };
}

export async function analyse(brand: BrandRow, results: QueryResult[], stats: Stats): Promise<ReportData> {
  const draft = await draftAnalysis(brand, results, stats);
  return editPass(draft);
}

/** Runs a snapshot end to end and persists everything against the snapshot row. */
export async function runSnapshot(snapshotId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: snap } = await supabaseAdmin.from("snapshots").select("*").eq("id", snapshotId).single();
  if (!snap) throw new Error("Snapshot not found");

  const progress = (message: string) =>
    supabaseAdmin.from("snapshots").update({ progress_message: message }).eq("id", snapshotId);

  try {
    await supabaseAdmin
      .from("snapshots")
      .update({ status: "processing", error_message: null, progress_message: "Reading the sky" })
      .eq("id", snapshotId);

    const { data: brandRow } = await supabaseAdmin.from("brands").select("*").eq("id", snap.brand_id).single();
    if (!brandRow) throw new Error("Brand not found");
    const brand = brandRow as unknown as BrandRow;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, full_name")
      .eq("id", snap.user_id)
      .single();
    const plan: PlanDef = planOf(profile?.plan);

    let { data: queryRows } = await supabaseAdmin
      .from("tracked_queries")
      .select("id, question, region, source")
      .eq("brand_id", brand.id)
      .eq("active", true);

    if (!queryRows || queryRows.length === 0) {
      await progress("Building your question library");
      const generated = await generateBaseQuestions(brand, Math.min(plan.maxQuestions, 10));
      const inserts = generated.map((question) => ({
        brand_id: brand.id,
        user_id: snap.user_id,
        question,
        source: "base",
      }));
      const { data: created } = await supabaseAdmin.from("tracked_queries").insert(inserts).select("id, question, region, source");
      queryRows = created ?? [];
    }

    let queries = (queryRows ?? []) as TrackedQuery[];
    if (!plan.customQuestions) queries = queries.filter((q) => q.source === "base");
    queries = queries.slice(0, plan.maxQuestions);
    if (queries.length === 0) throw new Error("No tracked questions to run.");

    await progress(`Asking ${queries.length} questions across the answer engines`);
    const results = await runQueries(brand, queries);
    const stats = computeStats(brand, results);
    if (stats.usableCount === 0) throw new Error("No answer engine returned a usable answer.");

    await progress("Clearing the fog");
    const report = await analyse(brand, results, stats);

    await progress("Exporting your PDF");
    const pdf = await renderReportPdf({
      report,
      brandName: brand.name,
      brandWebsite: brand.website,
      industry: brand.industry,
      competitors: brand.competitors,
      questionCount: queries.length,
      generatedAt: new Date(),
      branding: {
        whiteLabel: plan.whiteLabelText,
        agencyName: brand.agency_name,
      },
    });

    const path = `${snap.user_id}/${snapshotId}.pdf`;
    const upload = await supabaseAdmin.storage
      .from("reports")
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw new Error(upload.error.message);

    await supabaseAdmin
      .from("snapshots")
      .update({
        status: "complete",
        progress_message: null,
        completed_at: new Date().toISOString(),
        brand_visibility: stats.overall.brand,
        competitor_visibility: stats.overall.competitors as never,
        platform_stats: stats.byPlatform as never,
        report_json: report as never,
        raw_results: { results } as never,
        report_path: path,
        question_count: queries.length,
      })
      .eq("id", snapshotId);
  } catch (error) {
    await supabaseAdmin
      .from("snapshots")
      .update({
        status: "failed",
        progress_message: null,
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("id", snapshotId);
    throw error;
  }
}
