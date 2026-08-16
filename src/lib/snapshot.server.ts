import { activeEngines, callAI, parseJsonLoose, type Msg } from "./ai.server";
import { asLoose } from "./loose-client";
import { renderReportPdf } from "./pdf.server";
import {
  planOf,
  type BrandBrain,
  type BrandFact,
  type BrandKeyword,
  type BrandProduct,
  type PlanDef,
  type QueryResult,
  type ReportData,
  type SentimentLabel,
} from "./types";

const QUESTION_MODEL = "openai/gpt-5-mini";
const ANALYSIS_MODEL = "openai/gpt-5";
const EDITOR_MODEL = "openai/gpt-5-mini";
const SENTIMENT_MODEL = "openai/gpt-5-mini";

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

export type TrackedQuery = {
  id: string;
  question: string;
  region: string | null;
  source: string;
  keyword: string | null;
};

export type GeneratedQuestion = { question: string; keyword: string | null };

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

function brainContext(brain: BrandBrain | null): string {
  if (!brain) return "No brand brain configured yet.";
  const lines: string[] = [];
  if (brain.products.length) {
    lines.push(
      "Product lineup:",
      ...brain.products.map(
        (p) =>
          `- ${p.name}${p.category ? ` (${p.category})` : ""}${p.description ? `: ${p.description}` : ""}`,
      ),
    );
  }
  if (brain.facts.length) {
    lines.push("Facts & positioning:", ...brain.facts.map((f) => `- [${f.kind}] ${f.content}`));
  }
  if (brain.keywords.length) {
    lines.push(
      "Tracked keywords (priority order):",
      ...brain.keywords.map((k) => `- ${k.keyword} (priority ${k.priority})`),
    );
  }
  return lines.length ? lines.join("\n") : "No brand brain configured yet.";
}

export async function generateBaseQuestions(
  brand: BrandRow,
  count: number,
  brain: BrandBrain | null = null,
): Promise<GeneratedQuestion[]> {
  const raw = await callAI(
    QUESTION_MODEL,
    [
      {
        role: "system",
        content:
          'You generate realistic buyer-intent questions real people type into AI assistants when shopping, each tagged with the topic it belongs to. Respond with a JSON array of objects only: [{"question":"...","keyword":"..."}].',
      },
      {
        role: "user",
        content: `Industry / niche: ${brand.industry}
Target customer: ${brand.target_customer}
${brainContext(brain)}

Write ${count} distinct, natural buyer-intent questions someone in this niche would ask an AI assistant while evaluating options (best-of, recommendation, comparison, pricing, "who should I use" styles). Do not mention specific brand names. If a tracked keyword fits a question, tag it with that exact keyword; otherwise give it a short 1-2 word topic (e.g. "pricing"). Return only a JSON array of ${count} objects with keys question and keyword.`,
      },
    ],
    { maxTokens: 6000 },
  );
  const parsed = parseJsonLoose<{ question?: unknown; keyword?: unknown }[]>(raw);
  const questions = parsed
    .filter((q) => typeof q.question === "string" && q.question.trim().length > 5)
    .map((q) => ({
      question: q.question as string,
      keyword:
        typeof q.keyword === "string" && q.keyword.trim() ? (q.keyword as string).trim() : null,
    }))
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

async function mapLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out = new Array<T>(tasks.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;
      out[index] = await tasks[index]!();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return out;
}

/** Browser agents share one pool; keep at most 3 runs in flight at once. */
const MAX_CONCURRENT_RUNS = 3;

export async function runQueries(
  brand: BrandRow,
  queries: TrackedQuery[],
  brain: BrandBrain | null = null,
): Promise<QueryResult[]> {
  const engines = activeEngines();
  if (engines.length === 0) throw new Error("No answer engines are configured.");
  const products = brain?.products ?? [];
  const tasks: (() => Promise<QueryResult>)[] = [];
  for (const q of queries) {
    for (const engine of engines) {
      tasks.push(async () => {
        try {
          const { answer, sources } = await engine.ask(askMessages(q));
          return {
            question: q.question,
            region: q.region,
            platform: engine.label,
            engine: engine.id,
            answer,
            sources,
            keyword: q.keyword ?? null,
            brandMentioned: mentions(answer, brand.name),
            cited: citesDomain(answer, brand.website),
            competitorsMentioned: brand.competitors.filter((c) => mentions(answer, c)),
            productsMentioned: products.filter((p) => mentions(answer, p.name)).map((p) => p.name),
          };
        } catch (error) {
          return {
            question: q.question,
            region: q.region,
            platform: engine.label,
            engine: engine.id,
            answer: "",
            keyword: q.keyword ?? null,
            brandMentioned: false,
            cited: false,
            competitorsMentioned: [],
            productsMentioned: [],
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });
    }
  }
  return mapLimit(tasks, MAX_CONCURRENT_RUNS);
}

const pct = (hits: number, total: number) => (total === 0 ? 0 : Math.round((hits / total) * 100));

export function computeStats(
  brand: BrandRow,
  results: QueryResult[],
  brain: BrandBrain | null = null,
) {
  const usable = results.filter((r) => !r.error && r.answer);
  const platforms = Array.from(new Set(usable.map((r) => r.platform)));
  const products = brain?.products ?? [];

  const productStats = products
    .map((p) => {
      const rows = usable.filter((r) => (r.productsMentioned ?? []).includes(p.name));
      return {
        product: p.name,
        category: p.category,
        visibility: pct(rows.length, usable.length),
        byPlatform: platforms.map((platform) => ({
          platform,
          visibility: pct(
            rows.filter((r) => r.platform === platform).length,
            usable.filter((r) => r.platform === platform).length,
          ),
        })),
      };
    })
    .sort((a, b) => b.visibility - a.visibility);

  const keywordGroups = new Map<string, QueryResult[]>();
  for (const r of usable) {
    const key = r.keyword?.trim() || "Other";
    const bucket = keywordGroups.get(key) ?? [];
    bucket.push(r);
    keywordGroups.set(key, bucket);
  }
  const keywordStats = Array.from(keywordGroups.entries()).map(([keyword, rows]) => ({
    keyword,
    visibility: pct(rows.filter((r) => r.brandMentioned).length, rows.length),
    mentions: rows.filter((r) => r.brandMentioned).length,
    total: rows.length,
  }));
  const keywordOrder = (brain?.keywords ?? []).map((k) => k.keyword.toLowerCase());
  keywordStats.sort((a, b) => {
    if (a.keyword === "Other") return 1;
    if (b.keyword === "Other") return -1;
    const ia = keywordOrder.indexOf(a.keyword.toLowerCase());
    const ib = keywordOrder.indexOf(b.keyword.toLowerCase());
    if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    return b.visibility - a.visibility;
  });

  const scored = usable.filter((r) => r.sentiment);
  const countSentiment = (rows: QueryResult[]) => {
    const positive = rows.filter((r) => r.sentiment?.label === "positive").length;
    const negative = rows.filter((r) => r.sentiment?.label === "negative").length;
    return { positive, negative, neutral: rows.length - positive - negative, sample: rows.length };
  };
  const sentiment = {
    overall: countSentiment(scored),
    byPlatform: platforms.map((platform) => ({
      platform,
      ...countSentiment(scored.filter((r) => r.platform === platform)),
    })),
  };

  return {
    usableCount: usable.length,
    citationRate: pct(usable.filter((r) => r.cited).length, usable.length),
    overall: {
      brand: pct(usable.filter((r) => r.brandMentioned).length, usable.length),
      competitors: brand.competitors.map((name) => ({
        name,
        visibility: pct(
          usable.filter((r) => r.competitorsMentioned.includes(name)).length,
          usable.length,
        ),
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
          visibility: pct(
            rows.filter((r) => r.competitorsMentioned.includes(name)).length,
            rows.length,
          ),
        })),
      };
    }),
    products: productStats,
    keywords: keywordStats,
    sentiment,
  };
}

type Stats = ReturnType<typeof computeStats>;

/** Classify how each engine talked about the brand. Mutates results in place. */
export async function analyseSentiments(results: QueryResult[]): Promise<QueryResult[]> {
  const targets = results
    .map((r, i) => ({ index: i, result: r }))
    .filter(({ result }) => result.brandMentioned);
  if (targets.length === 0) return results;

  const input = targets
    .map(
      ({ index, result }) =>
        `[${index}] [${result.platform}]${result.region ? ` (region: ${result.region})` : ""} Q: ${result.question}\nAnswer: ${result.answer.slice(0, 600)}`,
    )
    .join("\n---\n");

  let parsed: { index?: unknown; label?: unknown; reason?: unknown }[] = [];
  try {
    const raw = await callAI(
      SENTIMENT_MODEL,
      [
        {
          role: "system",
          content:
            'You classify how an AI assistant talked about one brand in its answer (only that brand; ignore competitors). Return a JSON array with one object per numbered input: [{"index":0,"label":"positive","reason":"short clause"}]. label is exactly positive, neutral or negative. reason is one short clause like "recommended without caveats".',
        },
        {
          role: "user",
          content: `Classify each numbered answer below. Return only a JSON array.

${input}`,
        },
      ],
      { maxTokens: 4000 },
    );
    parsed = parseJsonLoose<{ index?: unknown; label?: unknown; reason?: unknown }[]>(raw);
  } catch {
    return results;
  }

  const labels = new Set<SentimentLabel>(["positive", "neutral", "negative"]);
  for (const item of parsed) {
    if (typeof item.index !== "number") continue;
    const target = targets.find((t) => t.index === item.index);
    if (!target || typeof item.label !== "string" || !labels.has(item.label as SentimentLabel))
      continue;
    target.result.sentiment =
      typeof item.reason === "string" && item.reason
        ? { label: item.label as SentimentLabel, reason: item.reason }
        : { label: item.label as SentimentLabel };
  }
  return results;
}

/** Pass 1: grounded draft that must cite the captured evidence. */
async function draftAnalysis(
  brand: BrandRow,
  results: QueryResult[],
  stats: Stats,
  brain: BrandBrain | null = null,
): Promise<ReportData> {
  const evidence = results
    .filter((r) => !r.error && r.answer)
    .map(
      (r, i) =>
        `[${i + 1}] [${r.platform}]${r.region ? ` (region: ${r.region})` : ""}${r.keyword ? ` (keyword: ${r.keyword})` : ""} Q: ${r.question}
Brand mentioned: ${r.brandMentioned ? "YES" : "NO"} | Site cited: ${r.cited ? "YES" : "NO"} | Competitors named: ${
          r.competitorsMentioned.join(", ") || "none"
        } | Products named: ${(r.productsMentioned ?? []).join(", ") || "none"}${
          r.sentiment
            ? ` | Sentiment: ${r.sentiment.label}${r.sentiment.reason ? ` (${r.sentiment.reason})` : ""}`
            : ""
        }${r.sources?.length ? ` | Sources: ${r.sources.join(", ")}` : ""}
Answer: ${r.answer.slice(0, 700)}`,
    )
    .join("\n---\n");

  const raw = await callAI(
    ANALYSIS_MODEL,
    [
      {
        role: "system",
        content:
          "You are a senior AI-search-visibility analyst. Every claim you make must be traceable to the numbered evidence provided, referenced by footnote number in square brackets. Never invent facts, brands or numbers. You may reference the brand brain to interpret evidence, but never assert a brain fact as if it appeared in an answer. Return ONLY valid JSON matching the requested shape.",
      },
      {
        role: "user",
        content: `Brand: ${brand.name} (${brand.website})
Industry: ${brand.industry}
Target customer: ${brand.target_customer}
Competitors tracked: ${brand.competitors.join(", ") || "none"}

Brand brain:
${brainContext(brain)}

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
Product-level visibility:
${stats.products.map((p) => `- ${p.product}: ${p.visibility}%${p.byPlatform.map((b) => ` (${b.platform}: ${b.visibility}%)`).join("")}`).join("\n") || "none"}
Keyword-level visibility:
${stats.keywords.map((k) => `- ${k.keyword}: ${k.visibility}% (${k.mentions}/${k.total} answers)`).join("\n") || "none"}
Sentiment when ${brand.name} is mentioned:
- Overall: ${stats.sentiment.overall.positive} positive / ${stats.sentiment.overall.neutral} neutral / ${stats.sentiment.overall.negative} negative (of ${stats.sentiment.overall.sample} answers)
${stats.sentiment.byPlatform.map((p) => `- ${p.platform}: ${p.positive} pos / ${p.neutral} neu / ${p.negative} neg`).join("\n")}

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
Exactly 5 action items, ordered by priority. Use only platforms present in the evidence. Where product or keyword data shows a gap, name the product or keyword in the narrative and cite its evidence.`,
      },
    ],
    { maxTokens: 8000 },
  );
  return normalise(parseJsonLoose(raw), stats);
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
      whyLosing:
        edited.whyLosing?.length === report.whyLosing.length ? edited.whyLosing : report.whyLosing,
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
    platforms?: {
      platform: string;
      summary?: string;
      exampleExcerpts?: { question: string; excerpt: string }[];
    }[];
    whyLosing?: string[];
    actionItems?: { title: string; detail: string; impact: string }[];
    closingNote?: string;
  },
  stats: Stats,
): ReportData {
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
    productVisibility: stats.products,
    keywordVisibility: stats.keywords,
    sentiment: stats.sentiment,
  };
}

export async function analyse(
  brand: BrandRow,
  results: QueryResult[],
  stats: Stats,
  brain: BrandBrain | null = null,
): Promise<ReportData> {
  const draft = await draftAnalysis(brand, results, stats, brain);
  return editPass(draft);
}

/** Runs a snapshot end to end and persists everything against the snapshot row. */
export async function runSnapshot(snapshotId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: snap } = await supabaseAdmin
    .from("snapshots")
    .select("*")
    .eq("id", snapshotId)
    .single();
  if (!snap) throw new Error("Snapshot not found");

  const progress = (message: string) =>
    supabaseAdmin.from("snapshots").update({ progress_message: message }).eq("id", snapshotId);

  try {
    await supabaseAdmin
      .from("snapshots")
      .update({ status: "processing", error_message: null, progress_message: "Reading the sky" })
      .eq("id", snapshotId);

    const { data: brandRow } = await supabaseAdmin
      .from("brands")
      .select("*")
      .eq("id", snap.brand_id)
      .single();
    if (!brandRow) throw new Error("Brand not found");
    const brand = brandRow as unknown as BrandRow;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, full_name")
      .eq("id", snap.user_id)
      .single();
    const plan: PlanDef = planOf(profile?.plan);

    const db = asLoose(supabaseAdmin);
    const [{ data: products }, { data: facts }, { data: keywords }] = await Promise.all([
      db
        .from<BrandProduct[]>("brand_products")
        .select("*")
        .eq("brand_id", brand.id)
        .order("sort_order", { ascending: true }),
      db.from<BrandFact[]>("brand_facts").select("*").eq("brand_id", brand.id),
      db
        .from<BrandKeyword[]>("brand_keywords")
        .select("*")
        .eq("brand_id", brand.id)
        .eq("active", true)
        .order("priority", { ascending: true }),
    ]);
    const brain: BrandBrain = {
      products: products ?? [],
      facts: facts ?? [],
      keywords: keywords ?? [],
    };

    let { data: queryRows } = await db
      .from<TrackedQuery[]>("tracked_queries")
      .select("id, question, region, source, keyword")
      .eq("brand_id", brand.id)
      .eq("active", true);

    if (!queryRows || queryRows.length === 0) {
      await progress("Building your question library");
      const generated = await generateBaseQuestions(brand, Math.min(plan.maxQuestions, 10), brain);
      const inserts = generated.map((g) => ({
        brand_id: brand.id,
        user_id: snap.user_id,
        question: g.question,
        keyword: g.keyword,
        source: "base",
      }));
      const { data: created } = await db
        .from<TrackedQuery[]>("tracked_queries")
        .insert(inserts)
        .select("id, question, region, source, keyword");
      queryRows = created ?? [];
    }

    let queries = queryRows ?? [];
    if (!plan.customQuestions) queries = queries.filter((q) => q.source === "base");
    queries = queries.slice(0, plan.maxQuestions);
    if (queries.length === 0) throw new Error("No tracked questions to run.");

    await progress(`Asking ${queries.length} questions across the answer engines`);
    let results = await runQueries(brand, queries, brain);

    await progress("Reading how each engine talks about you");
    results = await analyseSentiments(results);
    const stats = computeStats(brand, results, brain);
    if (stats.usableCount === 0) throw new Error("No answer engine returned a usable answer.");

    await progress("Clearing the fog");
    const report = await analyse(brand, results, stats, brain);

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
