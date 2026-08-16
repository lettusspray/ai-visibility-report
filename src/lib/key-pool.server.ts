const POOL_ENV = "BROWSER_USE_API_KEYS";
const SINGLE_ENV = "BROWSER_USE_API_KEY";
const COOLDOWN_MS = 60_000;
const MAX_FAILURES = 2;

type KeyEntry = { key: string; failures: number; until: number };

let pool: KeyEntry[] | null = null;
let cursor = 0;

function loadPool(): KeyEntry[] {
  const raw = process.env[POOL_ENV] ?? process.env[SINGLE_ENV] ?? "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .map((key) => ({ key, failures: 0, until: 0 }));
}

function getPool(): KeyEntry[] {
  if (!pool) pool = loadPool();
  return pool;
}

export function browserUseConfigured(): boolean {
  return getPool().length > 0;
}

export function keyCount(): number {
  return getPool().length;
}

function isHealthy(entry: KeyEntry): boolean {
  return entry.until === 0 || Date.now() >= entry.until;
}

/** Round-robin over the healthy keys; falls back to the next key even if all are cooling down. */
export function nextKey(): string {
  const entries = getPool();
  if (entries.length === 0) {
    throw new Error("Browser Use is not configured (missing BROWSER_USE_API_KEYS).");
  }
  for (let i = 0; i < entries.length; i += 1) {
    const idx = (cursor + i) % entries.length;
    const entry = entries[idx]!;
    if (isHealthy(entry)) {
      cursor = (idx + 1) % entries.length;
      return entry.key;
    }
  }
  const entry = entries[cursor]!;
  cursor = (cursor + 1) % entries.length;
  return entry.key;
}

export function reportFailure(key: string): void {
  const entry = getPool().find((e) => e.key === key);
  if (!entry) return;
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) entry.until = Date.now() + COOLDOWN_MS;
}

export function reportSuccess(key: string): void {
  const entry = getPool().find((e) => e.key === key);
  if (!entry) return;
  entry.failures = 0;
  entry.until = 0;
}
