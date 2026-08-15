import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getOrderStatus } from "@/lib/orders.functions";
import type { ReportData } from "@/lib/types";

export const Route = createFileRoute("/report/$token")({
  head: () => ({
    meta: [
      { title: "Your AI Search Visibility Report — VisibilityAudit" },
      { name: "description", content: "View and download your AI search visibility report as a PDF." },
      { property: "og:title", content: "Your AI Search Visibility Report — VisibilityAudit" },
      { property: "og:description", content: "View and download your AI search visibility report." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { token } = Route.useParams();
  const fetchStatus = useServerFn(getOrderStatus);
  const query = useQuery({
    queryKey: ["order-report", token],
    queryFn: () => fetchStatus({ data: { token } }),
  });

  const order = query.data;
  const report = (order?.report_json ?? null) as ReportData | null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-14">
        {query.isPending ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your report…
          </div>
        ) : !report ? (
          <div className="panel p-8">
            <h1 className="text-2xl font-semibold">This report isn't ready yet</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Generation is still running or hasn't started. Head back to your status page and give it a moment.
            </p>
            <a href={`/status/${token}`} className="mt-4 inline-block text-sm font-medium text-accent underline">
              Go to status page
            </a>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
              <div>
                <p className="text-eyebrow">AI search visibility report</p>
                <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{order?.brand_name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{order?.industry}</p>
              </div>
              {order?.downloadUrl ? (
                <a
                  href={order.downloadUrl}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Download className="h-4 w-4" /> Download PDF
                </a>
              ) : null}
            </div>

            <section className="mt-10">
              <h2 className="text-eyebrow">Executive summary</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{report.executiveSummary}</p>
              <div className="mt-6 space-y-3">
                <Bar name={order?.brand_name ?? "Your brand"} value={report.brandVisibility} highlight />
                {report.competitorVisibility.map((c) => (
                  <Bar key={c.name} name={c.name} value={c.visibility} />
                ))}
              </div>
            </section>

            <section className="mt-12">
              <h2 className="text-eyebrow">Platform breakdown</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {report.platforms.map((p) => (
                  <div key={p.platform} className="panel p-5">
                    <h3 className="font-semibold">{p.platform}</h3>
                    <p className="mt-1 font-display text-3xl font-semibold text-accent">{p.brandVisibility}%</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
                    {p.exampleExcerpts.slice(0, 2).map((ex) => (
                      <blockquote
                        key={ex.question}
                        className="mt-4 border-l-2 border-accent/50 pl-3 text-xs leading-relaxed text-muted-foreground"
                      >
                        <span className="block font-medium text-foreground">{ex.question}</span>“{ex.excerpt}”
                      </blockquote>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-12">
              <h2 className="text-eyebrow">Why you're losing the answer</h2>
              <ul className="mt-4 space-y-3">
                {report.whyLosing.map((w, i) => (
                  <li key={i} className="flex gap-3 border-t border-border pt-3 text-[15px] leading-relaxed">
                    <span className="font-display text-sm text-accent">0{i + 1}</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-12">
              <h2 className="text-eyebrow">Prioritised action plan</h2>
              <div className="mt-4 space-y-4">
                {report.actionItems.map((a, i) => (
                  <div key={a.title} className="panel p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold">
                        {i + 1}. {a.title}
                      </h3>
                      <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                        {a.impact}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-12 border-t border-border pt-6">
              <p className="text-sm leading-relaxed text-muted-foreground">{report.closingNote}</p>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Bar({ name, value, highlight }: { name: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className={highlight ? "font-medium" : "text-muted-foreground"}>{name}</span>
        <span className="font-display font-semibold">{value}%</span>
      </div>
      <div className="mt-1.5 h-2 w-full rounded-full bg-secondary">
        <div
          className={`h-2 rounded-full ${highlight ? "bg-accent" : "bg-muted-foreground/40"}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}