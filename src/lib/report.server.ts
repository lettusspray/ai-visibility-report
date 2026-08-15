import { callAI, parseJsonLoose } from "./ai.server";
import { renderReportPdf } from "./pdf.server";
import type { Platform, QueryResult, ReportData } from "./types";

const QUESTION_MODEL = "openai/gpt-5-mini";
const OPENAI_ANSWER_MODEL = "openai/gpt-5-mini";
const GEMINI_ANSWER_MODEL = "google/gemini-2.5-flash";
const ANALYSIS_MODEL = "openai/gpt-5";

type OrderRow = {
  id: string;
  email: string;
  tier: string;
  brand_name: string;
  brand_website: string;
  competitors: string[];
  industry: string;
  target_customer: string;
  agency_name: string | null;
  agency_logo_path: string | null;
  access_token: string;
};

function mentions(answer: string, name: string): boolean {
  const haystack = answer.toLowerCase();
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  const core = needle.replace(/\b(inc|llc|ltd|co|corp|group|agency|studio)\b\.?/g, "").trim();
  const bare = core.replace(/\.(com|io|co|net|ai|org)$/i, "").trim();
  return bare.length > 2 && haystack.includes(bare);
}

async function generateQuestions(order: OrderRow): Promise<string[]> {
  const raw = await callAI(QUESTION_MODEL, [
    {
      role: "system",
      content:
        "You generate realistic buyer-intent questions that real people type into AI assistants when shopping. Respond with a JSON array of strings only.",
    },
    {
      role: "user",
      content: `Industry / niche: ${order.industry}
Target customer: ${order.target_customer}

Write 9 distinct, natural buyer-intent questions a customer in this niche would ask an AI assistant while evaluating options (best/recommendation/comparison/pricing/"who should I use" style). Do not mention any specific brand names. Return only a JSON array of 9 strings.`,
    },
  ]);
  const questions = parseJsonLoose<string[]>(raw)
    .filter((q) => typeof q === "string" && q.trim().length > 5)
    .slice(0, 10);
  if (questions.length < 3) throw new Error("Question generation returned too few questions.");
  return questions;
}

async function askPerplexity(question: string): Promise<string> {
  const key = process.env["PERPLEXITY_API_KEY"];
  if (!key) throw new Error("Perplexity is not connected.");
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

async function askPlatform(platform: Platform, question: string): Promise<string> {
  const messages = [
    {
      role: "system" as const,
      content:
        "You are a helpful shopping assistant. Answer the user's question concretely, naming the specific companies, products or providers you would recommend. Keep it under 200 words.",
    },
    { role: "user" as const, content: question },
  ];
  if (platform === "OpenAI") return callAI(OPENAI_ANSWER_MODEL, messages);
  if (platform === "Gemini") return callAI(GEMINI_ANSWER_MODEL, messages);
  return askPerplexity(question);
}

export async function runQueries(order: OrderRow, questions: string[]): Promise<QueryResult[]> {
  const platforms: Platform[] = ["OpenAI", "Gemini", "Perplexity"];
  const tasks: Promise<QueryResult>[] = [];
  for (const question of questions) {
    for (const platform of platforms) {
      tasks.push(
        (async () => {
          try {
            const answer = await askPlatform(platform, question);
            return {
              question,
              platform,
              answer,
              brandMentioned: mentions(answer, order.brand_name),
              competitorsMentioned: order.competitors.filter((c) => mentions(answer, c)),
            };
          } catch (error) {
            return {
              question,
              platform,
              answer: "",
              brandMentioned: false,
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

function pct(hits: number, total: number): number {
  return total === 0 ? 0 : Math.round((hits / total) * 100);
}

export function computeStats(order: OrderRow, results: QueryResult[]) {
  const usable = results.filter((r) => !r.error && r.answer);
  const overall = {
    brand: pct(usable.filter((r) => r.brandMentioned).length, usable.length),
    competitors: order.competitors.map((name) => ({
      name,
      visibility: pct(usable.filter((r) => r.competitorsMentioned.includes(name)).length, usable.length),
    })),
  };
  const byPlatform = (["OpenAI", "Gemini", "Perplexity"] as Platform[]).map((platform) => {
    const rows = usable.filter((r) => r.platform === platform);
    return {
      platform,
      answers: rows.length,
      brand: pct(rows.filter((r) => r.brandMentioned).length, rows.length),
      competitors: order.competitors.map((name) => ({
        name,
        visibility: pct(rows.filter((r) => r.competitorsMentioned.includes(name)).length, rows.length),
      })),
    };
  });
  return { overall, byPlatform, usableCount: usable.length };
}

async function analyse(
  order: OrderRow,
  questions: string[],
  results: QueryResult[],
  stats: ReturnType<typeof computeStats>,
): Promise<ReportData> {
  const evidence = results
    .filter((r) => !r.error && r.answer)
    .map(
      (r) =>
        `[${r.platform}] Q: ${r.question}\nBrand mentioned: ${r.brandMentioned ? "YES" : "NO"} | Competitors named: ${
          r.competitorsMentioned.join(", ") || "none"
        }\nAnswer: ${r.answer.slice(0, 700)}`,
    )
    .join("\n---\n");

  const raw = await callAI(
    ANALYSIS_MODEL,
    [
      {
        role: "system",
        content:
          "You are a senior AI-search-visibility consultant writing a paid deliverable for a marketing agency's client. Be specific, evidence-driven and blunt. Reference concrete patterns from the data (who gets named, in what context, what phrasing recurs). No filler, no generic SEO advice. Return ONLY valid JSON matching the requested shape.",
      },
      {
        role: "user",
        content: `Brand: ${order.brand_name} (${order.brand_website})
Industry: ${order.industry}
Target customer: ${order.target_customer}
Competitors tracked: ${order.competitors.join(", ")}

Measured visibility (share of AI answers naming each brand):
Overall - ${order.brand_name}: ${stats.overall.brand}%; ${stats.overall.competitors
          .map((c) => `${c.name}: ${c.visibility}%`)
          .join("; ")}
${stats.byPlatform
  .map(
    (p) =>
      `${p.platform} (${p.answers} answers) - ${order.brand_name}: ${p.brand}%; ${p.competitors
        .map((c) => `${c.name}: ${c.visibility}%`)
        .join("; ")}`,
  )
  .join("\n")}

Raw evidence:
${evidence.slice(0, 60000)}

Return JSON:
{
  "executiveSummary": "3-5 sentence plain-English summary quantifying the gap",
  "platforms": [{"platform":"OpenAI|Gemini|Perplexity","summary":"2-4 sentences on how this platform behaves for this niche and where the brand stands","exampleExcerpts":[{"question":"...","excerpt":"a short verbatim excerpt (max 45 words) from an actual answer above"}]}],
  "whyLosing": ["4-6 specific diagnoses, each 2-3 sentences, each referencing an observed pattern in the answers"],
  "actionItems": [{"title":"short imperative","detail":"2-4 sentences, concrete and specific to this brand","impact":"one short line"}],
  "closingNote": "3-4 sentences on how to re-measure and what good looks like in 90 days"
}
Exactly 5 action items, ordered by priority. Use only platforms that appear in the evidence.`,
      },
    ],
    { maxTokens: 6000 },
  );

  const parsed = parseJsonLoose<{
    executiveSummary: string;
    platforms: { platform: string; summary: string; exampleExcerpts?: { question: string; excerpt: string }[] }[];
    whyLosing: string[];
    actionItems: { title: string; detail: string; impact: string }[];
    closingNote: string;
  }>(raw);

  return {
    executiveSummary: parsed.executiveSummary,
    brandVisibility: stats.overall.brand,
    competitorVisibility: stats.overall.competitors,
    platforms: stats.byPlatform
      .filter((p) => p.answers > 0)
      .map((p) => {
        const written = parsed.platforms?.find((x) =>
          x.platform.toLowerCase().includes(p.platform.toLowerCase()),
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

async function sendEmail(order: OrderRow, url: string): Promise<boolean> {
  const key = process.env["RESEND_API_KEY"];
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: process.env["REPORT_FROM_EMAIL"] ?? "VisibilityAudit <onboarding@resend.dev>",
      to: [order.email],
      subject: `Your AI Search Visibility Report for ${order.brand_name} is ready`,
      html: `<p>Your AI Search Visibility Report for <strong>${order.brand_name}</strong> is ready.</p>
<p><a href="${url}">View and download your report</a></p>
<p>This link is private — share it only with people who should see the report.</p>`,
    }),
  });
  return res.ok;
}

export async function generateReportForOrder(orderId: string, origin: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).single();
  if (error || !data) throw new Error(error?.message ?? "Order not found");
  const order = data as unknown as OrderRow;

  const progress = (message: string) =>
    supabaseAdmin.from("orders").update({ progress_message: message }).eq("id", orderId);

  try {
    await supabaseAdmin
      .from("orders")
      .update({ status: "processing", error_message: null, progress_message: "Generating buyer questions" })
      .eq("id", orderId);

    const questions = await generateQuestions(order);
    await progress(`Querying ${questions.length} questions across 3 AI platforms`);

    const results = await runQueries(order, questions);
    const stats = computeStats(order, results);
    if (stats.usableCount === 0) throw new Error("No AI platform returned a usable answer.");

    await progress("Analysing results");
    const report = await analyse(order, questions, results, stats);

    await progress("Building your PDF");
    let logo: { bytes: Uint8Array; contentType: string } | null = null;
    if (order.agency_logo_path) {
      const file = await supabaseAdmin.storage.from("logos").download(order.agency_logo_path);
      if (file.data) {
        logo = {
          bytes: new Uint8Array(await file.data.arrayBuffer()),
          contentType: file.data.type || (order.agency_logo_path.endsWith(".png") ? "image/png" : "image/jpeg"),
        };
      }
    }

    const pdf = await renderReportPdf({
      report,
      brandName: order.brand_name,
      brandWebsite: order.brand_website,
      industry: order.industry,
      competitors: order.competitors,
      questionCount: questions.length,
      generatedAt: new Date(),
      branding: {
        whiteLabel: order.tier === "whitelabel",
        agencyName: order.agency_name,
        logo,
      },
    });

    const path = `${order.id}/ai-visibility-report.pdf`;
    const upload = await supabaseAdmin.storage
      .from("reports")
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw new Error(upload.error.message);

    const reportUrl = `${origin}/report/${order.access_token}`;
    const emailSent = await sendEmail(order, reportUrl).catch(() => false);

    await supabaseAdmin
      .from("orders")
      .update({
        status: "complete",
        progress_message: null,
        report_path: path,
        report_json: report as never,
        raw_results: { questions, results } as never,
        email_sent: emailSent,
      })
      .eq("id", orderId);
  } catch (error) {
    await supabaseAdmin
      .from("orders")
      .update({
        status: "failed",
        progress_message: null,
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("id", orderId);
    throw error;
  }
}