import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { confirmAndStart, getOrderStatus } from "@/lib/orders.functions";

export const Route = createFileRoute("/status/$token")({
  validateSearch: z.object({ session_id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Generating your report — VisibilityAudit" },
      { name: "description", content: "Your AI search visibility report is being generated. This takes about two minutes." },
      { property: "og:title", content: "Generating your report — VisibilityAudit" },
      { property: "og:description", content: "Your AI search visibility report is being generated." },
    ],
  }),
  component: Status,
});

function Status() {
  const { token } = Route.useParams();
  const { session_id } = Route.useSearch();
  const fetchStatus = useServerFn(getOrderStatus);
  const start = useServerFn(confirmAndStart);
  const started = useRef(false);

  const query = useQuery({
    queryKey: ["order-status", token],
    queryFn: () => fetchStatus({ data: { token } }),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "complete" || s === "failed" ? false : 4000;
    },
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start({
      data: {
        token,
        origin: window.location.origin,
        ...(session_id ? { sessionId: session_id } : {}),
      },
    })
      .catch(() => undefined)
      .then(() => query.refetch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const order = query.data;
  const status = order?.status ?? "pending";

  useEffect(() => {
    if (status === "complete") {
      window.location.replace(`/report/${token}`);
    }
  }, [status, token]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-20">
        {status === "failed" ? (
          <div className="panel p-8">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <h1 className="mt-4 text-2xl font-semibold">Generation hit a problem</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {order?.error_message ?? "Something went wrong while building your report."} Your payment is safe — reply
              to your receipt and we'll regenerate it.
            </p>
          </div>
        ) : status === "complete" ? (
          <div className="panel p-8">
            <CheckCircle2 className="h-6 w-6 text-accent" />
            <h1 className="mt-4 text-2xl font-semibold">Your report is ready</h1>
            <Link to="/report/$token" params={{ token }} className="mt-4 inline-block text-sm font-medium text-accent underline">
              Open the report
            </Link>
          </div>
        ) : (
          <div className="panel p-8">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <p className="text-eyebrow">Generating</p>
            </div>
            <h1 className="mt-4 text-2xl font-semibold md:text-3xl">
              Building the visibility report{order?.brand_name ? ` for ${order.brand_name}` : ""}
            </h1>
            <p className="mt-3 text-muted-foreground">
              This takes about two minutes. We're querying ChatGPT, Gemini and Perplexity, scoring every answer and
              typesetting the PDF. You can leave this page open — we'll also email you the link.
            </p>
            <div className="mt-8 space-y-3 border-t border-border pt-6 text-sm">
              <Step label="Payment confirmed" done={order?.payment_status === "paid"} />
              <Step label="Writing buyer-intent questions" done={Boolean(order?.progress_message)} />
              <Step
                label={order?.progress_message ?? "Querying the AI engines"}
                done={false}
                active
              />
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Bookmark this page — it's your private link:{" "}
              <span className="font-mono">/status/{token.slice(0, 8)}…</span>
            </p>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Step({ label, done, active }: { label: string; done: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-accent" />
      ) : active ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <span className="h-4 w-4 rounded-full border border-border" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}