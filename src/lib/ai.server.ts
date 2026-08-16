import { submitAgentTask, type AskResult, type Msg } from "./browser-use.server";
import { browserUseConfigured } from "./key-pool.server";

export type { Msg } from "./browser-use.server";

const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash";

/** Analysis/generation LLM. Always uses DeepSeek v4 flash — no browser-use LLM fallback. */
export async function callAI(_model: string, messages: Msg[], opts: { maxTokens?: number } = {}) {
  return deepSeekLLM(messages, opts);
}

async function deepSeekLLM(messages: Msg[], opts: { maxTokens?: number } = {}): Promise<string> {
  const apiKey = process.env["DEEPSEEK_API_KEY"];
  if (!apiKey) throw new Error("DeepSeek is not configured (missing DEEPSEEK_API_KEY).");
  const payload: Record<string, unknown> = {
    model: DEEPSEEK_MODEL,
    messages,
    stream: false,
    thinking: { type: "disabled" },
  };
  if (opts.maxTokens) payload["max_tokens"] = opts.maxTokens;
  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

/**
 * Answer-engine registry. Every engine drives a real browser through Browser Use
 * hosted agents, so the answers match what a person actually sees in the web UI
 * (model version, UI prompts, citations) rather than what an API returns.
 */
export type Engine = {
  id: string;
  label: string;
  /** Engines with no credential or saved profile are skipped rather than failing a run. */
  available: () => boolean;
  ask: (messages: Msg[]) => Promise<AskResult>;
};

type SiteEngine = {
  id: string;
  label: string;
  site: string;
  loginHint: string;
  profileEnv?: string;
  /** Engines that work logged-out run immediately; others need a saved profile (M2). */
  loggedOutOk: boolean;
};

const SITES: SiteEngine[] = [
  {
    id: "browser-perplexity",
    label: "Perplexity",
    site: "https://www.perplexity.ai",
    loginHint: "Use the site as a logged-out visitor if no profile is saved.",
    profileEnv: "BROWSER_USE_PROFILE_PERPLEXITY",
    loggedOutOk: true,
  },
  {
    id: "browser-deepseek",
    label: "DeepSeek",
    site: "https://chat.deepseek.com",
    loginHint: "Use the site as a logged-out visitor if no profile is saved.",
    profileEnv: "BROWSER_USE_PROFILE_DEEPSEEK",
    loggedOutOk: true,
  },
  {
    id: "browser-chatgpt",
    label: "ChatGPT",
    site: "https://chatgpt.com",
    loginHint: "Use the site as a logged-out visitor if no profile is saved.",
    profileEnv: "BROWSER_USE_PROFILE_CHATGPT",
    loggedOutOk: true,
  },
  {
    id: "browser-gemini",
    label: "Gemini",
    site: "https://gemini.google.com/app",
    loginHint: "A saved profile must already be signed in; do not attempt to log in.",
    profileEnv: "BROWSER_USE_PROFILE_GEMINI",
    loggedOutOk: false,
  },
  {
    id: "browser-claude",
    label: "Claude",
    site: "https://claude.ai",
    loginHint: "A saved profile must already be signed in; do not attempt to log in.",
    profileEnv: "BROWSER_USE_PROFILE_CLAUDE",
    loggedOutOk: false,
  },
  // Reserved slots: add a saved profile and these light up unchanged.
  {
    id: "browser-metai",
    label: "Meta AI",
    site: "https://www.meta.ai",
    loginHint: "A saved profile must already be signed in; do not attempt to log in.",
    profileEnv: "BROWSER_USE_PROFILE_METAI",
    loggedOutOk: false,
  },
  {
    id: "browser-grok",
    label: "Grok",
    site: "https://grok.com",
    loginHint: "A saved profile must already be signed in; do not attempt to log in.",
    profileEnv: "BROWSER_USE_PROFILE_GROK",
    loggedOutOk: false,
  },
];

function siteAvailable(site: SiteEngine): boolean {
  if (!browserUseConfigured()) return false;
  if (site.loggedOutOk) return true;
  return Boolean(process.env[site.profileEnv ?? ""]);
}

function buildTask(site: SiteEngine, messages: Msg[]): string {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const question = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  return [
    `You operate a monitoring browser. Navigate to ${site.site}.`,
    site.loginHint,
    "Do not create an account and do not answer the question yourself.",
    "",
    `Enter the exact text below into the chat input on that site and press send:`,
    question,
    "",
    "Wait until the answer has finished generating completely (no more streaming or thinking indicators). Then return:",
    "1. The full answer text the visitor sees, verbatim and unsummarized.",
    "2. A final line beginning with SOURCES: followed by each source or citation URL the interface shows, separated by spaces.",
    "",
    system,
  ].join("\n");
}

const ENGINES: Engine[] = SITES.map((site) => ({
  id: site.id,
  label: site.label,
  available: () => siteAvailable(site),
  ask: async (messages: Msg[]): Promise<AskResult> =>
    submitAgentTask({
      task: buildTask(site, messages),
      proxyCountryCode: process.env["BROWSER_USE_PROXY_COUNTRY"] ?? null,
    }),
}));

export function activeEngines(): Engine[] {
  return ENGINES.filter((e) => e.available());
}

export function parseJsonLoose<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1)) as T;
    throw new Error("Could not parse model JSON output.");
  }
}
