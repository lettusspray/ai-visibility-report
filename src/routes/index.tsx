import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check, FileText, Search, Sparkles } from "lucide-react";

import { ReportPreview } from "@/components/report-preview";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VisibilityAudit — AI Search Visibility Reports for Agencies" },
      {
        name: "description",
        content:
          "A $99 one-time, white-label-ready PDF showing whether ChatGPT, Gemini and Perplexity recommend your client — or their competitors.",
      },
      { property: "og:title", content: "VisibilityAudit — AI Search Visibility Reports for Agencies" },
      {
        property: "og:description",
        content: "Done-for-you AI visibility audits your agency can put straight in front of a client.",
      },
    ],
  }),
  component: Index,
});

const deliverables = [
  {
    title: "8–10 real buyer questions",
    body: "We model the questions your client's customers actually type into an AI assistant when they're ready to buy.",
  },
  {
    title: "Three engines, side by side",
    body: "Every question is run against ChatGPT, Google Gemini and Perplexity, and every answer is scanned for your client and their competitors.",
  },
  {
    title: "A consultant-grade analysis",
    body: "Visibility percentages, per-platform breakdowns, verbatim answer excerpts and a blunt read on why competitors are winning the answer.",
  },
  {
    title: "Five prioritised actions",
    body: "Specific moves for this brand in this niche — not a generic SEO checklist.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="rule-grid border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-accent-soft px-3 py-1 text-[11px] font-semibold tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                For marketing agencies
              </span>
              <h1 className="mt-6 text-4xl leading-[1.08] font-semibold text-balance md:text-6xl">
                Your client's competitors are being recommended by ChatGPT. Your client isn't.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Buyers now ask an AI assistant who to hire, what to buy and which brand is best — and it answers
                with three names. VisibilityAudit measures whether your client is one of them, across ChatGPT,
                Gemini and Perplexity, and hands you a finished report you can put in front of them tomorrow.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  to="/buy"
                  search={{ tier: "standard" }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Order a report — $99
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#sample"
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  See what's inside
                </a>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                One-time purchase. No subscription, no login, no dashboard to learn.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-surface-deep text-surface-deep-foreground">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-3">
            {[
              { stat: "3", label: "AI engines tested per report: ChatGPT, Gemini, Perplexity" },
              { stat: "~30", label: "Individual AI answers captured, scored and quoted" },
              { stat: "2 min", label: "From checkout to a finished, client-ready PDF" },
            ].map((item) => (
              <div key={item.label}>
                <div className="font-display text-4xl font-semibold text-accent">{item.stat}</div>
                <p className="mt-2 text-sm leading-relaxed text-surface-deep-foreground/75">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-eyebrow">The deliverable</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-4xl">
              A done-for-you PDF, not another tool your team has to run
            </h2>
            <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {deliverables.map((item, i) => (
                <div key={item.title} className="border-t border-border pt-5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-sm text-accent">0{i + 1}</span>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="sample" className="scroll-mt-20 border-b border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-eyebrow">Sample report</p>
                <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Six sections. Zero filler.</h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Cover, executive summary with visibility scoring, per-platform breakdown with verbatim AI excerpts,
                the "why you're losing" analysis, a prioritised action plan and a closing methodology page.
              </p>
            </div>
            <div className="mt-10">
              <ReportPreview />
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-eyebrow">Pricing</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Pay once, per report.</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <PriceCard
                tier="standard"
                name="Agency Report"
                price="$99"
                summary="The full audit, delivered as a PDF with our methodology page."
                features={[
                  "8–10 buyer-intent questions",
                  "ChatGPT, Gemini and Perplexity coverage",
                  "Visibility scoring vs up to 3 competitors",
                  "Why-you're-losing analysis + 5 action items",
                  "PDF emailed and available to download",
                ]}
              />
              <PriceCard
                tier="whitelabel"
                name="Agency Report + White Label"
                price="$149"
                highlight
                summary="The same audit, published under your agency's name."
                features={[
                  "Everything in the Agency Report",
                  "Our branding removed everywhere",
                  "Your agency name on the cover and footer",
                  "Upload your logo for the cover page",
                  "Resell it at your own price",
                ]}
              />
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-3xl font-semibold">Find out what the AI says about your client</h2>
              <p className="mt-3 text-muted-foreground">
                Five minutes of intake. Two minutes of generation. One report that starts a retainer conversation.
              </p>
            </div>
            <Link
              to="/buy"
              search={{ tier: "standard" }}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start an audit
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function PriceCard(props: {
  tier: "standard" | "whitelabel";
  name: string;
  price: string;
  summary: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`panel flex flex-col p-8 ${props.highlight ? "border-accent/50 ring-1 ring-accent/20" : ""}`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {props.highlight ? <Search className="h-4 w-4 text-accent" /> : <FileText className="h-4 w-4" />}
        <span className="text-eyebrow">{props.highlight ? "White label" : "Standard"}</span>
      </div>
      <h3 className="mt-4 text-xl font-semibold">{props.name}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{props.summary}</p>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="font-display text-5xl font-semibold">{props.price}</span>
        <span className="text-sm text-muted-foreground">one-time</span>
      </div>
      <ul className="mt-6 flex-1 space-y-3 text-sm">
        {props.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/buy"
        search={{ tier: props.tier }}
        className={`mt-8 inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-medium transition-opacity hover:opacity-90 ${
          props.highlight
            ? "bg-accent text-accent-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        Choose {props.name}
      </Link>
    </div>
  );
}
