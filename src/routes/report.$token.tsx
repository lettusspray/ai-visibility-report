import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Logo } from "@/components/site-header";
import { ClearingSky, SunMark } from "@/components/weather";
import { getSharedSnapshot } from "@/lib/public.functions";

export const Route = createFileRoute("/report/$token")({
  head: () => ({
    meta: [
      { title: "AI visibility report — Mercercroft" },
      { name: "description", content: "A shared Mercercroft AI visibility snapshot with current conditions and actions." },
      { property: "og:title", content: "AI visibility report — Mercercroft" },
      { property: "og:description", content: "Current conditions, the forecast and how to clear the fog." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { token } = Route.useParams();
  const fetchSnapshot = useServerFn(getSharedSnapshot);
  const { data, isLoading } = useQuery({
    queryKey: ["shared", token],
    queryFn: () => fetchSnapshot({ data: { token } }),
    refetchInterval: (q) => (q.state.data?.status === "complete" ? false : 8000),
  });

  const report = data?.report as
    | { executiveSummary: string; whyLosing: string[]; actionItems: { title: string; detail: string; impact: string }[] }
    | null
    | undefined;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Logo />
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Mercercroft</Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">
        {isLoading || !data ? (
          <div className="cloud-card p-10"><ClearingSky label="Loading this report…" /></div>
        ) : data.status !== "complete" ? (
          <div className="cloud-card p-10"><ClearingSky label="This report is still generating. It takes about two minutes." /></div>
        ) : (
          <>
            <p className="text-eyebrow">{data.brand?.agencyName ?? "Mercercroft"}</p>
            <h1 className="mt-2 text-3xl font-semibold">{data.brand?.name} — AI visibility snapshot</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {new Date(data.createdAt).toLocaleDateString()} · {data.questionCount} questions
            </p>
            {data.pdfUrl ? (
              <a href={data.pdfUrl} className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">
                Download the PDF
              </a>
            ) : null}
            <div className="cloud-card mt-8 p-8">
              <SunMark className="h-8 w-8 text-accent" />
              <h2 className="mt-4 text-xl font-semibold">Current conditions</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{report?.executiveSummary}</p>
            </div>
            <div className="cloud-card mt-6 p-8">
              <h2 className="text-xl font-semibold">Clearing the fog</h2>
              <ol className="mt-4 space-y-4 text-sm">
                {(report?.actionItems ?? []).map((a, i) => (
                  <li key={a.title}>
                    <p className="font-medium">{i + 1}. {a.title}</p>
                    <p className="mt-1 text-muted-foreground">{a.detail}</p>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
