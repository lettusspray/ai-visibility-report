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
          "Track how ChatGPT, Gemini, Perplexity and DeepSeek recommend your business, watch the trend over time, and get clear actions to be recommended more often.",
      },
      { property: "og:title", content: "Mercercroft — Remove uncertainty in AI search" },
      {
        property: "og:description",
        content:
          "Change how AI understands your business — and increase how often it recommends you.",
      },
      { property: "og:url", content: "https://mercercroft.com/" },
      { name: "twitter:title", content: "Mercercroft — Remove uncertainty in AI search" },
      {
        name: "twitter:description",
        content:
          "Change how AI understands your business — and increase how often it recommends you.",
      },
    ],
    links: [{ rel: "canonical", href: "https://mercercroft.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Mercercroft",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://mercercroft.com/",
          description:
            "Track how ChatGPT, Gemini, Perplexity and DeepSeek recommend your business, watch the trend over time, and get clear actions to be recommended more often.",
          offers: [
            {
              "@type": "Offer",
              name: "Free",
              price: "0",
              priceCurrency: "USD",
              url: "https://mercercroft.com/#pricing",
            },
            {
              "@type": "Offer",
              name: "Starter",
              price: "99",
              priceCurrency: "USD",
              url: "https://mercercroft.com/#pricing",
            },
            {
              "@type": "Offer",
              name: "Pro",
              price: "149",
              priceCurrency: "USD",
              url: "https://mercercroft.com/#pricing",
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

const steps = [
  {
    icon: CloudMark,
    title: "We map the questions",
    body: "Up to 75 buyer-intent questions for your niche, tagged by product and keyword. Add your own with region tags.",
  },
  {
    icon: RainMark,
    title: "We ask every engine",
    body: "ChatGPT, Gemini, Perplexity and DeepSeek answer through real browser sessions — the same results a person would see, not API shortcuts.",
  },
  {
    icon: IsobarMark,
    title: "We chart the pressure",
    body: "Each run is stored so you see visibility move over time. Product mentions, keyword visibility and sentiment tracked per engine.",
  },
  {
    icon: SunMark,
    title: "We clear the fog",
    body: "A grounded two-pass analysis of why answers go elsewhere, with prioritised actions, an exportable PDF and a shareable link.",
  },
];

const features = [
  {
    title: "Brand Brain",
    body: "Feed in your products, key messaging and target keywords. The pipeline uses this context to compute a product map, keyword visibility scores and per-engine sentiment — so you see exactly what AI assistants know about you.",
  },
  {
    title: "Product Map",
    body: "Which of your products does each engine actually mention — and which does it ignore? Broken down per platform so you know exactly where to focus your effort.",
  },
  {
    title: "Keyword Visibility",
    body: "Track how often each target keyword appears across engines. Spot the gaps between what you say and what AI assistants repeat back to your customers.",
  },
  {
    title: "Sentiment Analysis",
    body: "Every answer tagged positive, neutral or negative with a one-line reason. See the overall mood and per-engine breakdown at a glance — know when AI is singing your praises or warning people off.",
  },
];

const comparison = [
  {
    name: "Mercercroft",
    price: "Free · $99 · $149 / mo",
    position:
      "Full-stack visibility: product map, keyword tracking, sentiment, brand brain context, white-label PDF and shareable links. Starts free.",
    edge: true,
  },
  {
    name: "ZeroRank",
    price: "From ~$99 / mo",
    position:
      "AI search monitoring with optimisation workflows. No product-level tracking, no sentiment analysis, no white-label exports.",
  },
  {
    name: "Ahrefs Brand Radar",
    price: "Bundled with Ahrefs (from ~$129 / mo)",
    position:
      "AI mention tracking inside a wider SEO suite. Requires full Ahrefs subscription — no standalone AI visibility product.",
  },
  {
    name: "Profound",
    price: "Enterprise, from ~$500 / mo",
    position:
      "Answer-engine analytics for larger in-house teams. Too costly without product-level tracking or exports.",
  },
  {
    name: "Peec AI",
    price: "From ~€90 / mo",
    position:
      "AI visibility dashboards for brands and agencies. Dashboards only — no product map, no keyword tracking, no PDF export.",
  },
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
        {/* ── Hero ── */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-1.5 text-xs font-semibold text-foreground">
                <SunBehindCloudMark className="h-4 w-4" />
                AI visibility tracking
              </span>
              <h1 className="mt-6 text-4xl leading-[1.1] font-semibold text-balance md:text-5xl">
                Remove uncertainty. Understand how your business is being recommended by AI.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Track mentions, sentiment and citations across ChatGPT, Gemini, Perplexity and
                DeepSeek — then get clear actions to be recommended more often. Your first snapshot
                is free.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Start free
                </Link>
                <a
                  href="#pricing"
                  className="rounded-full border border-input bg-card px-6 py-3 text-sm font-medium hover:bg-secondary"
                >
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
                {[
                  ["ChatGPT", 44],
                  ["Gemini", 31],
                  ["Perplexity", 39],
                  ["DeepSeek", 42],
                ].map(([p, v]) => (
                  <div key={p as string}>
                    <div className="flex justify-between text-sm">
                      <span>{p}</span>
                      <span className="text-muted-foreground">{v}%</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-storm-soft">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                Know your forecast before your competitor does.
              </p>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" className="scroll-mt-24 border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-eyebrow">How it works</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-4xl">
              From gloomy to happy clouds
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {steps.map((s) => (
                <div key={s.title} className="cloud-card p-7">
                  <s.icon className="h-9 w-9 text-primary" />
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="scroll-mt-24 border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-eyebrow">What you get</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-4xl">
              More than a visibility score
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {features.map((f) => (
                <div key={f.title} className="cloud-card p-7">
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="scroll-mt-24 border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-eyebrow">Pricing</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
              Clear skies ahead, or find out why not.
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {Object.values(PLANS).map((plan) => (
                <div
                  key={plan.id}
                  className={`cloud-card flex flex-col p-8 ${plan.id === "starter" ? "ring-2 ring-accent/40" : ""}`}
                >
                  <p className="text-eyebrow">{plan.name}</p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-4xl font-semibold">
                      {plan.priceUsd === 0 ? "Free" : `$${plan.priceUsd}`}
                    </span>
                    {plan.priceUsd > 0 ? (
                      <span className="text-sm text-muted-foreground">/ month USD</span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{plan.blurb}</p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted-foreground">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <SunMark className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => choose(plan.id)}
                    disabled={busy === plan.id}
                    className={`mt-8 rounded-full px-5 py-3 text-sm font-medium disabled:opacity-60 ${plan.id === "starter" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}
                  >
                    {busy === plan.id
                      ? "Opening checkout…"
                      : plan.priceUsd === 0
                        ? "Start free"
                        : `Choose ${plan.name}`}
                  </button>
                </div>
              ))}
            </div>
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
            <p className="mt-4 text-sm text-muted-foreground">
              Billing in USD via Paystack. Cancel any time.
            </p>

            <h3 className="mt-16 text-2xl font-semibold">How we compare</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              What each product offers at its entry price. Mercercroft is the only one with product
              mapping, keyword tracking, sentiment analysis, brand brain context and white-label
              export — starting free.
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-160 border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">Product</th>
                    <th className="py-3 pr-4 font-medium">Entry pricing</th>
                    <th className="py-3 font-medium">What you get</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr
                      key={row.name}
                      className={`border-b border-border/70 ${"edge" in row && row.edge ? "bg-primary/5" : ""}`}
                    >
                      <td className="py-3 pr-4 font-medium">
                        {row.name}
                        {"edge" in row && row.edge ? (
                          <span className="ml-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Us
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.price}</td>
                      <td className="py-3 text-muted-foreground">{row.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section>
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-3xl font-semibold">
                Know your forecast before your competitor does.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Your first snapshot is free. It takes about two minutes.
              </p>
            </div>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Start free
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
