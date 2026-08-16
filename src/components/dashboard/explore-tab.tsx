import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { ExploreMark } from "@/components/weather";
import { getSnapshotAnswers } from "@/lib/app.functions";

import type { AnswerRow, SnapshotRow } from "./types";

const unique = <T,>(values: T[]): T[] => Array.from(new Set(values));

export function ExploreTab({ snapshots }: { snapshots: SnapshotRow[] }) {
  const complete = snapshots.filter((s) => s.status === "complete");
  const getAnswers = useServerFn(getSnapshotAnswers);

  const [snapshotId, setSnapshotId] = useState(complete[0]?.id ?? "");
  const [compare, setCompare] = useState(false);
  const [platform, setPlatform] = useState("all");
  const [region, setRegion] = useState("all");
  const [keyword, setKeyword] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [search, setSearch] = useState("");

  const answers = useQuery({
    queryKey: ["answers", snapshotId],
    enabled: Boolean(snapshotId),
    queryFn: () => getAnswers({ data: { id: snapshotId } }),
  });

  const rows = useMemo(() => (answers.data?.results ?? []) as AnswerRow[], [answers.data]);
  const previous = useMemo(
    () => (compare ? (answers.data?.previous?.results ?? []) : []) as AnswerRow[],
    [compare, answers.data],
  );

  const optionSets = useMemo(() => {
    return {
      platforms: unique(rows.map((r) => r.platform)),
      regions: unique(rows.map((r) => r.region).filter((r): r is string => Boolean(r))),
      keywords: unique(rows.map((r) => r.keyword).filter((r): r is string => Boolean(r))),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (platform !== "all" && r.platform !== platform) return false;
      if (region !== "all" && (r.region ?? "") !== region) return false;
      if (keyword !== "all" && (r.keyword ?? "") !== keyword) return false;
      if (sentiment !== "all" && (r.sentiment?.label ?? "") !== sentiment) return false;
      if (q && !r.question.toLowerCase().includes(q) && !r.answer.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [rows, platform, region, keyword, sentiment, search]);

  if (complete.length === 0) {
    return (
      <div className="cloud-card p-10 text-center">
        <ExploreMark className="mx-auto h-10 w-10 text-storm" />
        <h3 className="mt-4 text-lg font-semibold">Nothing to explore yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Run a snapshot first; every answer it gathers lives here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="cloud-card p-6">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Snapshot</span>
            <select
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {complete.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  — {s.question_count ?? 0} questions
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
              className="h-4 w-4"
            />
            Compare to previous snapshot
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Filter
            label="Engine"
            value={platform}
            onChange={setPlatform}
            options={optionSets.platforms}
          />
          <Filter label="Region" value={region} onChange={setRegion} options={optionSets.regions} />
          <Filter
            label="Keyword"
            value={keyword}
            onChange={setKeyword}
            options={optionSets.keywords}
          />
          <Filter
            label="Sentiment"
            value={sentiment}
            onChange={setSentiment}
            options={["positive", "neutral", "negative"]}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions & answers…"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {rows.length} answers
          </p>
          <button
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="rounded-full bg-secondary px-5 py-2 text-sm font-medium hover:text-foreground disabled:opacity-60"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="cloud-card p-10 text-center text-sm text-muted-foreground">
            No answers match these filters.
          </div>
        ) : (
          filtered.map((r, i) => (
            <AnswerItem
              key={`${r.engine ?? r.platform}-${r.question}-${i}`}
              row={r}
              previous={previous}
              compare={compare}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="all">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function AnswerItem({
  row,
  previous,
  compare,
}: {
  row: AnswerRow;
  previous: AnswerRow[];
  compare: boolean;
}) {
  const [open, setOpen] = useState(false);
  const prev = compare
    ? previous.find((p) => p.question === row.question && p.platform === row.platform)
    : undefined;
  const changed = Boolean(prev && prev.answer !== row.answer);
  const sources = unique(row.sources ?? []);
  return (
    <div className="cloud-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent">
          {row.platform}
        </span>
        {row.region ? (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            {row.region}
          </span>
        ) : null}
        {row.keyword ? (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            {row.keyword}
          </span>
        ) : null}
        {row.sentiment ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              row.sentiment.label === "positive"
                ? "bg-accent/20 text-accent"
                : row.sentiment.label === "negative"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {row.sentiment.label}
            {row.sentiment.reason ? ` · ${row.sentiment.reason}` : ""}
          </span>
        ) : null}
        {row.brandMentioned ? (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            brand mentioned
          </span>
        ) : null}
        {row.cited ? (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            site cited
          </span>
        ) : null}
        {row.productsMentioned?.length ? (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            products: {row.productsMentioned.join(", ")}
          </span>
        ) : null}
        {compare ? (
          prev ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${changed ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"}`}
            >
              {changed ? "changed" : "same as last run"}
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
              new question
            </span>
          )
        ) : null}
      </div>
      <p className="mt-3 font-medium">{row.question}</p>
      {row.error ? (
        <p className="mt-2 text-sm text-destructive">{row.error}</p>
      ) : (
        <>
          <p
            className={`mt-2 text-sm leading-relaxed text-muted-foreground ${open ? "" : "line-clamp-3"}`}
          >
            {row.answer}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={() => setOpen(!open)} className="text-xs font-medium underline">
              {open ? "Show less" : "Show full answer"}
            </button>
            {prev && changed ? (
              <button
                onClick={() => setOpen(!open)}
                className="text-xs text-muted-foreground underline"
              >
                previous: "{prev.answer.slice(0, 60)}…"
              </button>
            ) : null}
            {sources.length ? (
              <span className="text-xs text-muted-foreground">
                Sources:{" "}
                {sources.slice(0, 4).map((s, i) => (
                  <a
                    key={s}
                    href={s}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground"
                  >
                    {domain(s)}
                    {i < Math.min(sources.length, 4) - 1 ? ", " : ""}
                  </a>
                ))}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

function exportCsv(rows: AnswerRow[]) {
  const esc = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = [
    "question",
    "engine",
    "region",
    "keyword",
    "sentiment",
    "brandMentioned",
    "siteCited",
    "competitors",
    "products",
    "answer",
    "sources",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.question,
        r.platform,
        r.region ?? "",
        r.keyword ?? "",
        r.sentiment?.label ?? "",
        r.brandMentioned ? "yes" : "no",
        r.cited ? "yes" : "no",
        r.competitorsMentioned.join("; "),
        (r.productsMentioned ?? []).join("; "),
        r.answer,
        (r.sources ?? []).join("; "),
      ]
        .map(esc)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mercercroft-answers.csv";
  a.click();
  URL.revokeObjectURL(url);
}
