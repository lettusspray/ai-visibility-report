import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { BrainMark } from "@/components/weather";
import {
  getBrandBrain,
  saveBrandFacts,
  saveBrandKeywords,
  saveBrandProducts,
} from "@/lib/app.functions";
import type { BrandFact, BrandKeyword, BrandProduct } from "@/lib/types";

type ProductDraft = { name: string; category: string; description: string };
type FactDraft = { kind: "fact" | "messaging"; content: string; sourceUrl: string };
type KeywordDraft = { keyword: string; priority: number };

export function BrainTab({ brandId }: { brandId: string }) {
  const qc = useQueryClient();
  const getBrain = useServerFn(getBrandBrain);
  const saveProducts = useServerFn(saveBrandProducts);
  const saveFacts = useServerFn(saveBrandFacts);
  const saveKeywords = useServerFn(saveBrandKeywords);

  const brain = useQuery({
    queryKey: ["brain", brandId],
    queryFn: () => getBrain({ data: { brandId } }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["brain", brandId] });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const products = (brain.data?.products ?? []) as unknown as BrandProduct[];
  const facts = (brain.data?.facts ?? []) as unknown as BrandFact[];
  const keywords = (brain.data?.keywords ?? []) as unknown as BrandKeyword[];

  return (
    <div className="space-y-6">
      <div className="cloud-card p-8">
        <div className="flex items-center gap-3">
          <BrainMark className="h-8 w-8 text-accent" />
          <div>
            <h3 className="text-lg font-semibold">Brand brain</h3>
            <p className="text-sm text-muted-foreground">
              What your brand sells and believes. Powers product-aware questions, per-product
              visibility, sentiment and grounded analysis.
            </p>
          </div>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ProductsCard
          initial={products.map((p) => ({
            name: p.name,
            category: p.category ?? "",
            description: p.description ?? "",
          }))}
          busy={busy}
          onSave={(rows) => run(() => saveProducts({ data: { brandId, products: rows } }))}
        />
        <KeywordsCard
          initial={keywords.map((k) => ({ keyword: k.keyword, priority: k.priority }))}
          busy={busy}
          onSave={(rows) => run(() => saveKeywords({ data: { brandId, keywords: rows } }))}
        />
      </div>

      <FactsCard
        initial={facts.map((f) => ({
          kind: f.kind,
          content: f.content,
          sourceUrl: f.source_url ?? "",
        }))}
        busy={busy}
        onSave={(rows) => run(() => saveFacts({ data: { brandId, facts: rows } }))}
      />
    </div>
  );
}

function ProductsCard({
  initial,
  busy,
  onSave,
}: {
  initial: ProductDraft[];
  busy: boolean;
  onSave: (rows: ProductDraft[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<ProductDraft[]>([]);
  useEffect(() => {
    setRows(initial.length ? initial : [{ name: "", category: "", description: "" }]);
  }, [initial]);
  return (
    <Card
      title="Product map"
      hint="Each product is scanned for in every AI answer. The report shows per-product visibility and which product gaps hurt you most."
      busy={busy}
      onAdd={() => setRows([...rows, { name: "", category: "", description: "" }])}
      onSave={() => onSave(rows.filter((r) => r.name.trim()))}
    >
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-2xl bg-secondary p-3">
            <div className="flex gap-2">
              <input
                value={row.name}
                onChange={(e) => update(rows, setRows, i, "name", e.target.value)}
                placeholder="Product or service name"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                value={row.category}
                onChange={(e) => update(rows, setRows, i, "category", e.target.value)}
                placeholder="Category"
                className="w-36 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="rounded-lg px-2 text-sm text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                ×
              </button>
            </div>
            <input
              value={row.description}
              onChange={(e) => update(rows, setRows, i, "description", e.target.value)}
              placeholder="Short description (optional)"
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function KeywordsCard({
  initial,
  busy,
  onSave,
}: {
  initial: KeywordDraft[];
  busy: boolean;
  onSave: (rows: KeywordDraft[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<KeywordDraft[]>([]);
  useEffect(() => {
    setRows(initial.length ? initial : [{ keyword: "", priority: 1 }]);
  }, [initial]);
  return (
    <Card
      title="Keywords"
      hint="Topics you want to win. New snapshots tag every question with a keyword, so the report shows visibility per keyword. Higher priority sorts first."
      busy={busy}
      onAdd={() => setRows([...rows, { keyword: "", priority: 1 }])}
      onSave={() => onSave(rows.filter((r) => r.keyword.trim()))}
    >
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={row.keyword}
              onChange={(e) => update(rows, setRows, i, "keyword", e.target.value)}
              placeholder="e.g. pricing"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              max={9}
              value={row.priority}
              onChange={(e) => update(rows, setRows, i, "priority", Number(e.target.value))}
              className="w-20 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              title="Priority 1-9"
            />
            <button
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              className="rounded-lg px-2 text-sm text-muted-foreground hover:text-destructive"
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FactsCard({
  initial,
  busy,
  onSave,
}: {
  initial: FactDraft[];
  busy: boolean;
  onSave: (rows: FactDraft[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<FactDraft[]>([]);
  useEffect(() => {
    setRows(initial.length ? initial : [{ kind: "fact", content: "", sourceUrl: "" }]);
  }, [initial]);
  return (
    <Card
      title="Facts & messaging"
      hint="True facts about the brand and its key messages. The analyst reads these to interpret evidence — it never presents them as something an assistant said."
      busy={busy}
      onAdd={() => setRows([...rows, { kind: "fact", content: "", sourceUrl: "" }])}
      onSave={() => onSave(rows.filter((r) => r.content.trim()))}
    >
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-2xl bg-secondary p-3">
            <div className="flex items-center gap-2">
              <select
                value={row.kind}
                onChange={(e) => update(rows, setRows, i, "kind", e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="fact">Fact</option>
                <option value="messaging">Messaging</option>
              </select>
              <button
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="rounded-lg px-2 text-sm text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                ×
              </button>
            </div>
            <textarea
              value={row.content}
              onChange={(e) => update(rows, setRows, i, "content", e.target.value)}
              placeholder="e.g. Founded 2014; 2-day delivery; lifetime warranty."
              rows={2}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={row.sourceUrl}
              onChange={(e) => update(rows, setRows, i, "sourceUrl", e.target.value)}
              placeholder="Source URL (optional)"
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function Card({
  title,
  hint,
  busy,
  onAdd,
  onSave,
  children,
}: {
  title: string;
  hint: string;
  busy: boolean;
  onAdd: () => void;
  onSave: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="cloud-card p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
        <button
          onClick={onAdd}
          disabled={busy}
          className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          Add
        </button>
      </div>
      <div className="mt-5">{children}</div>
      <button
        onClick={async () => {
          await onSave();
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
        disabled={busy}
        className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}

function update<T>(
  rows: T[],
  setRows: (r: T[]) => void,
  index: number,
  key: keyof T,
  value: unknown,
) {
  setRows(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
}
