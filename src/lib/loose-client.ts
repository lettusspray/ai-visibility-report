type ErrorLike = { message?: string } | null;

export type LooseEnvelope<T> = { data: T | null; error: ErrorLike };

/**
 * Minimal chainable shape for tables that are not yet in the generated Supabase
 * types. Type-only — the real builder is the standard supabase-js client.
 */
export interface LooseChain<T = unknown> extends PromiseLike<LooseEnvelope<T>> {
  select(columns?: string): LooseChain<T>;
  eq(column: string, value: unknown): LooseChain<T>;
  order(column: string, opts?: { ascending?: boolean }): LooseChain<T>;
  limit(count: number): LooseChain<T>;
  single(): Promise<LooseEnvelope<T>>;
  maybeSingle(): Promise<LooseEnvelope<T>>;
  insert(rows: unknown): LooseChain<T>;
  update(value: unknown): LooseChain<T>;
  delete(): LooseChain<T>;
}

export interface LooseClient {
  from<T = unknown>(table: string): LooseChain<T>;
}

export function asLoose(client: unknown): LooseClient {
  return client as LooseClient;
}
