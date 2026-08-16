import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { CloudMark, IsobarMark, RainMark, SunBehindCloudMark, SunMark } from "@/components/weather";
import { PLANS, type PlanId } from "@/lib/types";
import { startCheckout } from "@/lib/app.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mercercroft — Remove uncertainty in AI search" },
      {
        name: "description",
        content:
          "Track how ChatGPT, Gemini and Perplexity recommend your business, watch the trend over time, and get clear actions to be recommended more often.",
      },
      { property: "og:title", content: "Mercercroft — Remove uncertainty in AI search" },
      {
        property: "og:description",
        content: "Change how AI understands your business — and increase how often it recommends you.",
      },
    ],
  }),
  component: Index,
});

const steps = [
  { icon: CloudMark, title: "We map the questions", body: "Up to 75 buyer-intent questions for your niche, plus any you add yourself with an optional region tag." },
  { icon: RainMark, title: "We run them across the engines", body: "ChatGPT, Gemini and Perplexity answer every question. We record mentions, citations and the answer text." },
  { icon: IsobarMark, title: "We chart the pressure", body: "Each run is stored, so you see visibility move over time instead of guessing from one reading." },
  { icon: SunMark, title: "We clear the fog", body: "A grounded analysis of why answers go elsewhere, with prioritised actions and an exportable report." },
];

const comparison = [
  { name: "Mercercroft", price: "Free · $99 · $149 / mo", position: "Tracking plus a client-ready report export, white-label on paid plans." },
  { name: "ZeroRank", price: "From ~$99 / mo", position: "AI search visibility monitoring with optimisation workflows." },
  { name: "Ahrefs Brand Radar", price: "Bundled with Ahrefs plans (from ~$129 / mo)", position: "AI mention tracking inside the wider Ahrefs SEO suite." },
  { name: "Profound", price: "Enterprise, from ~$500 / mo", position: "Answer-engine analytics aimed at larger in-house teams." },
  { name: "Peec AI", price: "From ~€90 / mo", position: "AI visibility dashboards for brands and agencies." },
  { name: "AirOps", price: "From ~$199 / mo", position: "Content workflow automation with AI-visibility measurement attached." },
];

function Index() {
  const navigate = useNavigate();
  const checkout = useServerFn(startCheckout);
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(plan: PlanId) {
    setError(null);
    const { data } = await supabase.auth.getSession();
    if (!data.session) return navigate({ to: "/auth", search: { mode: "signup" } });
    if (plan === "free") return navigate({ to: "/dashboard" });
    setBusy(plan);
    try {
      const res = await checkout({ data: { plan, origin: window.location.origin } });
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout is unavailable right now.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-1.5 text-xs font-semibold text-accent">
                <SunBehindCloudMark className="h-4 w-4" />
                AI visibility tracking
              </span>
              <h1 className="mt-6 text-4xl leading-[1.1] font-semibold text-balance md:text-5xl">
                Remove uncertainty. Understand how your business is being recommended by AI.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Change how AI understands your business — and increase how often it recommends you.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/auth" search={{ mode: "signup" }} className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">
                  Start free
                </Link>
                <a href="#pricing" className="rounded-full border border-input bg-card px-6 py-3 text-sm font-medium hover:bg-secondary">
                  See plans
                </a>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Stop flying blind in AI search.</p>
            </div>
            <div className="cloud-card p-8">
              <p className="text-eyebrow">From gloomy to happy clouds</p>
              <div className="mt-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Your visibility today</p>
                  <p className="font-display text-5xl font-semibold">38%</p>
                </div>
                <SunBehindCloudMark className="h-16 w-16 text-accent" />
              </div>
              <div className="mt-6 space-y-3">
                {[["ChatGPT", 44], ["Gemini", 31], ["Perplexity", 39]].map(([p, v]) => (
                  <div key={p as string}>
                    <div className="flex justify-between text-sm"><span>{p}</span><span className="text-muted-foreground">{v}%</span></div>
                    <div className="mt-1.5 h-2 rounded-full bg-storm-soft">
                      <div className="h-2 rounded-full bg-accent" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-muted-foreground">Know your forecast before your competitor does.</p>
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-24 border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-eyebrow">How it works</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-4xl">From gloomy to happy clouds</h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {steps.map((s) => (
                <div key={s.title} className="cloud-card p-7">
                  <s.icon className="h-9 w-9 text-storm" />
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-eyebrow">Pricing</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Clear skies ahead, or find out why not.</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {(Object.values(PLANS)).map((plan) => (
                <div key={plan.id} className={`cloud-card flex flex-col p-8 ${plan.id === "starter" ? "ring-2 ring-accent/40" : ""}`}>
                  <p className="text-eyebrow">{plan.name}</p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-4xl font-semibold">{plan.priceUsd === 0 ? "Free" : `$${plan.priceUsd}`}</span>
                    {plan.priceUsd > 0 ? <span className="text-sm text-muted-foreground">/ month USD</span> : null}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{plan.blurb}</p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted-foreground">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2"><SunMark className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{f}</li>
                    ))}
                  </ul>
                  <button
                    onClick={() => choose(plan.id)}
                    disabled={busy === plan.id}
                    className={`mt-8 rounded-full px-5 py-3 text-sm font-medium disabled:opacity-60 ${plan.id === "starter" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}
                  >
                    {busy === plan.id ? "Opening checkout…" : plan.priceUsd === 0 ? "Start free" : `Choose ${plan.name}`}
                  </button>
                </div>
              ))}
            </div>
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
            <p className="mt-4 text-sm text-muted-foreground">Billing in USD via Paystack. Cancel any time.</p>

            <h3 className="mt-16 text-2xl font-semibold">How we compare</h3>
            <p className="mt-2 text-sm text-muted-foreground">Public pricing and positioning, as advertised by each product. Figures change; check their sites for current rates.</p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-160 border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">Product</th>
                    <th className="py-3 pr-4 font-medium">Entry pricing</th>
                    <th className="py-3 font-medium">Positioning</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.name} className="border-b border-border/70">
                      <td className="py-3 pr-4 font-medium">{row.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.price}</td>
                      <td className="py-3 text-muted-foreground">{row.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-3xl font-semibold">Know your forecast before your competitor does.</h2>
              <p className="mt-3 text-muted-foreground">Your first snapshot is free. It takes about two minutes.</p>
            </div>
            <Link to="/auth" search={{ mode: "signup" }} className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">
              Start free
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
