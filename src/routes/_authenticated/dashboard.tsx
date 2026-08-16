import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Logo } from "@/components/site-header";
import { ClearingSky, IsobarMark, RainMark, SunMark } from "@/components/weather";
import {
  addCustomQuery,
  getMe,
  listQueries,
  listSnapshots,
  saveBrand,
  startSnapshot,
} from "@/lib/app.functions";
import { planOf } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your AI visibility dashboard — Mercercroft" },
      { name: "description", content: "Current conditions, the forecast and how to clear the fog for your brand." },
      { property: "og:title", content: "Your AI visibility dashboard — Mercercroft" },
      { property: "og:description", content: "Track how ChatGPT, Gemini and Perplexity recommend your business." },
    ],
  }),
  component: Dashboard,
});

type Tab = "current" | "forecast" | "fog";

function Dashboard() {
  const qc = useQueryClient();
  const me = useServerFn(getMe);
  const save = useServerFn(saveBrand);
  const start = useServerFn(startSnapshot);
  const snaps = useServerFn(listSnapshots);
  const queries = useServerFn(listQueries);
  const addQ = useServerFn(addCustomQuery);

  const [tab, setTab] = useState<Tab>("current");
  const account = useQuery({ queryKey: ["me"], queryFn: () => me({ data: undefined }) });
  const brand = account.data?.brands?.[0] ?? null;
  const plan = planOf(account.data?.profile?.plan);

  const snapshots = useQuery({
    queryKey: ["snapshots", brand?.id],
    enabled: Boolean(brand?.id),
    refetchInterval: 8000,
    queryFn: () => snaps({ data: { brandId: brand!.id } }),
  });
  const trackedQueries = useQuery({
    queryKey: ["queries", brand?.id],
    enabled: Boolean(brand?.id),
    queryFn: () => queries({ data: { brandId: brand!.id } }),
  });

  const latest = snapshots.data?.find((s) => s.status === "complete") ?? snapshots.data?.[0] ?? null;
  const running = snapshots.data?.some((s) => s.status === "pending" || s.status === "processing");

  const run = useMutation({
    mutationFn: () => start({ data: { brandId: brand!.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snapshots"] }),
  });

  if (account.isLoading) return <Shell><ClearingSky label="Checking the sky…" /></Shell>;
  if (!brand) return <Shell><BrandForm onSave={async (v) => { await save({ data: v }); qc.invalidateQueries({ queryKey: ["me"] }); }} /></Shell>;

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">{plan.name} plan</p>
          <h1 className="mt-1 text-3xl font-semibold">{brand.name}</h1>
          <p className="text-sm text-muted-foreground">{brand.website}</p>
        </div>
        <button
          onClick={() => run.mutate()}
          disabled={run.isPending || running}
          className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {running ? "Snapshot in progress…" : "Run a new snapshot"}
        </button>
      </div>
      {run.error ? <p className="mt-3 text-sm text-destructive">{(run.error as Error).message}</p> : null}

      <div className="mt-8 flex flex-wrap gap-2">
        {([
          ["current", "Current Conditions", SunMark],
          ["forecast", "The Forecast", IsobarMark],
          ["fog", "Clearing the Fog", RainMark],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors ${
              tab === id ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {running || !latest || latest.status !== "complete" ? (
          <div className="cloud-card p-10">
            <ClearingSky
              done={latest?.status === "complete"}
              label={latest?.progress_message ?? "Run a snapshot to see your conditions. This takes about two minutes."}
            />
          </div>
        ) : tab === "current" ? (
          <CurrentConditions snapshot={latest} />
        ) : tab === "forecast" ? (
          <Forecast rows={(snapshots.data ?? []).filter((s) => s.status === "complete")} allowed={plan.trendHistory} />
        ) : (
          <Fog snapshot={latest} />
        )}
      </div>

      <section className="mt-10 cloud-card p-8">
        <h2 className="text-xl font-semibold">Tracked questions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {trackedQueries.data?.length ?? 0} questions in the library for {brand.name}.
        </p>
        {plan.customQuestions ? (
          <AddQuestion
            onAdd={async (question, region) => {
              await addQ({ data: { brandId: brand.id, question, region } });
              qc.invalidateQueries({ queryKey: ["queries"] });
            }}
          />
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Custom questions are part of Starter. <Link to="/" hash="pricing" className="underline">See plans</Link>.
          </p>
        )}
        <ul className="mt-5 space-y-2 text-sm">
          {(trackedQueries.data ?? []).slice(0, 40).map((q) => (
            <li key={q.id} className="flex items-start justify-between gap-4 border-b border-border/70 pb-2">
              <span>{q.question}</span>
              {q.region ? <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{q.region}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

function CurrentConditions({ snapshot }: { snapshot: { brand_visibility: number | null; competitor_visibility: unknown; platform_stats: unknown } }) {
  const competitors = (snapshot.competitor_visibility as { name: string; visibility: number }[] | null) ?? [];
  const platforms = (snapshot.platform_stats as { platform: string; brandVisibility: number }[] | null) ?? [];
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="cloud-card p-8 md:col-span-1">
        <SunMark className="h-8 w-8 text-accent" />
        <p className="mt-4 text-eyebrow">Your visibility</p>
        <p className="font-display text-6xl font-semibold">{Math.round(snapshot.brand_visibility ?? 0)}%</p>
        <p className="mt-2 text-sm text-muted-foreground">Share of AI answers that mention you.</p>
      </div>
      <div className="cloud-card p-8 md:col-span-2">
        <h3 className="text-lg font-semibold">Against your competitors</h3>
        <ul className="mt-5 space-y-4">
          {competitors.map((c) => (
            <li key={c.name}>
              <div className="flex justify-between text-sm"><span>{c.name}</span><span className="text-muted-foreground">{Math.round(c.visibility)}%</span></div>
              <div className="mt-1.5 h-2 rounded-full bg-storm-soft">
                <div className="h-2 rounded-full bg-storm" style={{ width: `${Math.min(100, c.visibility)}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-lg font-semibold">By engine</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {platforms.map((p) => (
            <div key={p.platform} className="rounded-2xl bg-secondary p-4">
              <p className="text-sm text-muted-foreground">{p.platform}</p>
              <p className="font-display text-2xl font-semibold">{Math.round(p.brandVisibility)}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Forecast({ rows, allowed }: { rows: { created_at: string; brand_visibility: number | null }[]; allowed: boolean }) {
  if (!allowed)
    return (
      <div className="cloud-card p-10 text-center">
        <IsobarMark className="mx-auto h-10 w-10 text-storm" />
        <h3 className="mt-4 text-lg font-semibold">Trend history is part of Starter</h3>
        <p className="mt-2 text-sm text-muted-foreground">Know your forecast before your competitor does.</p>
      </div>
    );
  const data = [...rows].reverse().map((r) => ({
    date: new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    visibility: Math.round(r.brand_visibility ?? 0),
  }));
  return (
    <div className="cloud-card p-8">
      <h3 className="text-lg font-semibold">Visibility over time</h3>
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="visibility" stroke="var(--color-accent)" strokeWidth={2.5} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Fog({ snapshot }: { snapshot: { report_json?: unknown } }) {
  const report = snapshot.report_json as
    | { whyLosing?: string[]; actionItems?: { title: string; detail: string; impact: string }[] }
    | null
    | undefined;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="cloud-card p-8">
        <h3 className="text-lg font-semibold">Why the sky is grey</h3>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          {(report?.whyLosing ?? []).map((w) => <li key={w}>{w}</li>)}
        </ul>
      </div>
      <div className="cloud-card p-8">
        <h3 className="text-lg font-semibold">Clearing the fog</h3>
        <ol className="mt-4 space-y-4 text-sm">
          {(report?.actionItems ?? []).map((a, i) => (
            <li key={a.title}>
              <p className="font-medium">{i + 1}. {a.title}</p>
              <p className="mt-1 text-muted-foreground">{a.detail}</p>
              <p className="mt-1 text-xs text-muted-foreground">Impact: {a.impact}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function AddQuestion({ onAdd }: { onAdd: (q: string, region: string | null) => Promise<void> }) {
  const [question, setQuestion] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-5 flex flex-wrap gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!question.trim()) return;
        setBusy(true);
        await onAdd(question.trim(), region.trim() || null);
        setQuestion("");
        setRegion("");
        setBusy(false);
      }}
    >
      <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Add a question your buyers ask" className="min-w-64 flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm" />
      <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region (optional)" className="w-44 rounded-xl border border-input bg-background px-4 py-2.5 text-sm" />
      <button disabled={busy} className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">Add</button>
    </form>
  );
}

function BrandForm({ onSave }: { onSave: (v: { name: string; website: string; industry: string; targetCustomer: string; competitors: string[] }) => Promise<void> }) {
  const [v, setV] = useState({ name: "", website: "", industry: "", targetCustomer: "", c1: "", c2: "", c3: "" });
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="cloud-card mx-auto max-w-xl p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          name: v.name,
          website: v.website,
          industry: v.industry,
          targetCustomer: v.targetCustomer,
          competitors: [v.c1, v.c2, v.c3].filter(Boolean),
        });
        setBusy(false);
      }}
    >
      <h1 className="text-2xl font-semibold">Set up the brand you're tracking</h1>
      <p className="mt-2 text-sm text-muted-foreground">We use this to write the questions your buyers actually ask.</p>
      <div className="mt-6 space-y-3">
        {([
          ["name", "Brand name"],
          ["website", "Website"],
          ["industry", "Industry or niche"],
          ["c1", "Competitor 1"],
          ["c2", "Competitor 2"],
          ["c3", "Competitor 3 (optional)"],
        ] as const).map(([k, label]) => (
          <input
            key={k}
            required={k !== "c3"}
            value={v[k]}
            onChange={(e) => setV({ ...v, [k]: e.target.value })}
            placeholder={label}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
          />
        ))}
        <textarea
          required
          value={v.targetCustomer}
          onChange={(e) => setV({ ...v, targetCustomer: e.target.value })}
          placeholder="Who is the target customer?"
          rows={3}
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
        />
      </div>
      <button disabled={busy} className="mt-6 w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {busy ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}
