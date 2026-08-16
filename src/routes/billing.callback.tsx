import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { ClearingSky } from "@/components/weather";
import { Logo } from "@/components/site-header";
import { confirmCheckout } from "@/lib/app.functions";

export const Route = createFileRoute("/billing/callback")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ reference: typeof s["reference"] === "string" ? s["reference"] : "" }),
  head: () => ({
    meta: [
      { title: "Confirming your subscription — Mercercroft" },
      { name: "description", content: "Finishing up your Mercercroft subscription." },
      { property: "og:title", content: "Confirming your subscription — Mercercroft" },
      { property: "og:description", content: "Finishing up your Mercercroft subscription." },
    ],
  }),
  component: Callback,
});

function Callback() {
  const { reference } = Route.useSearch();
  const confirm = useServerFn(confirmCheckout);
  const navigate = useNavigate();
  const [state, setState] = useState<"working" | "done" | "failed">("working");

  useEffect(() => {
    if (!reference) return setState("failed");
    confirm({ data: { reference } })
      .then((r) => {
        setState(r.ok ? "done" : "failed");
        if (r.ok) setTimeout(() => navigate({ to: "/dashboard" }), 1800);
      })
      .catch(() => setState("failed"));
  }, [reference, confirm, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-6"><Logo /></div>
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <div className="cloud-card p-10">
          <ClearingSky done={state === "done"} label={state === "working" ? "Confirming your payment…" : state === "done" ? "You're all set. Clear skies ahead." : "We couldn't confirm that payment."} />
          <Link to="/dashboard" className="mt-4 inline-block rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Go to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
