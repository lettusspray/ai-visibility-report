const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type Msg = { role: "system" | "user"; content: string };

async function chatCompletions(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: Msg[],
  maxTokens?: number,
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      ...(maxTokens ? { max_completion_tokens: maxTokens } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Lovable AI Gateway (OpenAI + Gemini models). Used for generation and analysis too. */
export async function callAI(model: string, messages: Msg[], opts: { maxTokens?: number } = {}) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI gateway is not configured (missing LOVABLE_API_KEY).");
  return chatCompletions(GATEWAY, apiKey, model, messages, opts.maxTokens);
}

/**
 * Answer-engine registry. Every engine is a secret-backed adapter with the same
 * shape, so new coverage (Claude, DeepSeek, ...) is a new entry here and nothing else.
 */
export type Engine = {
  id: string;
  label: string;
  /** Engines with no configured credential are skipped rather than failing a run. */
  available: () => boolean;
  ask: (messages: Msg[]) => Promise<string>;
};

const ENGINES: Engine[] = [
  {
    id: "openai",
    label: "ChatGPT",
    available: () => Boolean(process.env["LOVABLE_API_KEY"]),
    ask: (messages) => callAI("openai/gpt-5-mini", messages),
  },
  {
    id: "gemini",
    label: "Gemini",
    available: () => Boolean(process.env["LOVABLE_API_KEY"]),
    ask: (messages) => callAI("google/gemini-2.5-flash", messages),
  },
  {
    id: "perplexity",
    label: "Perplexity",
    available: () => Boolean(process.env["PERPLEXITY_API_KEY"]),
    ask: (messages) =>
      chatCompletions(
        "https://api.perplexity.ai/chat/completions",
        process.env["PERPLEXITY_API_KEY"]!,
        "sonar",
        messages,
      ),
  },
  // Reserved slots: add the credential as a secret and these light up unchanged.
  {
    id: "claude",
    label: "Claude",
    available: () => Boolean(process.env["ANTHROPIC_API_KEY"]),
    ask: async (messages) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env["ANTHROPIC_API_KEY"]!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 700,
          system: messages.filter((m) => m.role === "system").map((m) => m.content).join("\n"),
          messages: messages.filter((m) => m.role === "user").map((m) => ({ role: "user", content: m.content })),
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}`);
      const json = (await res.json()) as { content?: { text?: string }[] };
      return json.content?.map((c) => c.text ?? "").join("") ?? "";
    },
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    available: () => Boolean(process.env["DEEPSEEK_API_KEY"]),
    ask: (messages) =>
      chatCompletions(
        "https://api.deepseek.com/chat/completions",
        process.env["DEEPSEEK_API_KEY"]!,
        "deepseek-chat",
        messages,
      ),
  },
];

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
