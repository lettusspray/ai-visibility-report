import { keyCount, nextKey, reportFailure, reportSuccess } from "./key-pool.server";

export type Msg = { role: "system" | "user"; content: string };

const AGENT_API = "https://api.browser-use.com/api/v4";
const POLL_INTERVAL_MS = 3000;
const DEFAULT_RUN_TIMEOUT_MS = 240_000;

export type AskResult = {
  answer: string;
  sources: string[];
  runId: string | null;
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function agentFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = nextKey();
  const res = await fetch(`${AGENT_API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-browser-use-api-key": key,
      ...init.headers,
    },
  });
  if (res.status === 401 || res.status === 402 || res.status === 429) reportFailure(key);
  else reportSuccess(key);
  if (!res.ok)
    throw new Error(`Browser Use ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

function extractResult(run: Record<string, unknown>): AskResult {
  const result = (run["result"] ?? run["output"] ?? run) as Record<string, unknown>;
  let answer = "";
  if (typeof result === "string") {
    answer = result;
  } else if (result) {
    for (const key of [
      "outputText",
      "output_text",
      "extractedContent",
      "content",
      "text",
      "answer",
      "summary",
    ]) {
      const value = result[key];
      if (typeof value === "string" && value.trim()) {
        answer = value;
        break;
      }
    }
  }
  if (!answer && typeof run["outputText"] === "string") answer = run["outputText"] as string;

  const sources: string[] = [];
  const resultSources = result && typeof result === "object" ? result["sources"] : undefined;
  if (Array.isArray(resultSources)) {
    for (const item of resultSources) {
      const entry = typeof item === "string" ? item : (item as Record<string, unknown>);
      const url = typeof entry === "string" ? entry : (entry?.["url"] ?? entry?.["link"]);
      if (typeof url === "string" && url) sources.push(url);
    }
  }
  for (const match of answer.match(/https?:\/\/[^\s"')<>]+/g) ?? []) {
    if (!sources.includes(match)) sources.push(match);
  }

  return {
    answer: answer.trim(),
    sources,
    runId: typeof run["id"] === "string" ? (run["id"] as string) : null,
  };
}

const TERMINAL: string[] = ["completed", "failed", "cancelled"];

export async function submitAgentTask(input: {
  task: string;
  model?: string;
  proxyCountryCode?: string | null;
  maxSteps?: number;
  timeoutMs?: number;
}): Promise<AskResult> {
  const model = input.model ?? process.env["BROWSER_USE_MODEL"] ?? "gpt-5.6-luna";
  const body: Record<string, unknown> = { task: input.task, model };
  if (input.maxSteps) body["maxSteps"] = input.maxSteps;
  if (input.proxyCountryCode) body["proxyCountryCode"] = input.proxyCountryCode;

  const attempts = Math.max(1, Math.min(3, keyCount()));
  const timeoutMs = input.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const run = await agentFetch<{ id?: string; status?: string }>("/runs", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const runId = run?.id;
      if (!runId) throw new Error("Browser Use did not return a run id.");

      const deadline = Date.now() + timeoutMs;
      let status = run.status ?? "queued";
      while (!TERMINAL.includes(status)) {
        if (Date.now() > deadline) throw new Error("Browser Use run timed out.");
        await sleep(POLL_INTERVAL_MS);
        const poll = await agentFetch<{ status?: string }>(`/runs/${runId}/status`);
        status = poll?.status ?? status;
      }
      if (status !== "completed") throw new Error(`Browser Use run ${status}.`);

      const full = await agentFetch<Record<string, unknown>>(`/runs/${runId}`);
      return extractResult(full);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /(429|5\d\d|timed out)/.test(message);
      if (retryable && attempt < attempts - 1) continue;
      throw error;
    }
  }
  throw new Error("Browser Use task failed.");
}
