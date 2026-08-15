import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { createOrder } from "@/lib/orders.functions";
import { TIERS, type Tier } from "@/lib/types";

export const Route = createFileRoute("/buy")({
  validateSearch: z.object({
    tier: z.enum(["standard", "whitelabel"]).catch("standard"),
    canceled: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Order an AI Visibility Report — VisibilityAudit" },
      {
        name: "description",
        content: "Tell us the brand, the competitors and the niche. We generate the AI search visibility report.",
      },
      { property: "og:title", content: "Order an AI Visibility Report — VisibilityAudit" },
      { property: "og:description", content: "Five minutes of intake, then a client-ready PDF report." },
    ],
  }),
  component: Buy,
});

type FormState = {
  brandName: string;
  brandWebsite: string;
  competitor1: string;
  competitor2: string;
  competitor3: string;
  industry: string;
  targetCustomer: string;
  agencyName: string;
  email: string;
};

const empty: FormState = {
  brandName: "",
  brandWebsite: "",
  competitor1: "",
  competitor2: "",
  competitor3: "",
  industry: "",
  targetCustomer: "",
  agencyName: "",
  email: "",
};

function Buy() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const submit = useServerFn(createOrder);

  const [tier, setTier] = useState<Tier>(search.tier);
  const [form, setForm] = useState<FormState>(empty);
  const [logo, setLogo] = useState<{ base64: string; type: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return setLogo(null);
    if (!/image\/(png|jpe?g)/.test(file.type)) {
      setError("Logo must be a PNG or JPG file.");
      return;
    }
    if (file.size > 2_000_000) {
      setError("Logo must be under 2 MB.");
      return;
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    buffer.forEach((b) => (binary += String.fromCharCode(b)));
    setError(null);
    setLogo({ base64: btoa(binary), type: file.type, name: file.name });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const competitors = [form.competitor1, form.competitor2, form.competitor3]
      .map((c) => c.trim())
      .filter(Boolean);
    if (competitors.length < 2) {
      setError("Please add at least two competitors.");
      return;
    }
    if (form.targetCustomer.trim().length < 10) {
      setError("Please describe the target customer in a little more detail.");
      return;
    }

    setBusy(true);
    try {
      const result = await submit({
        data: {
          tier,
          email: form.email.trim(),
          brandName: form.brandName.trim(),
          brandWebsite: form.brandWebsite.trim(),
          industry: form.industry.trim(),
          targetCustomer: form.targetCustomer.trim(),
          competitors,
          origin: window.location.origin,
          ...(tier === "whitelabel" && form.agencyName.trim() ? { agencyName: form.agencyName.trim() } : {}),
          ...(tier === "whitelabel" && logo ? { logoBase64: logo.base64, logoType: logo.type } : {}),
        },
      });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-eyebrow">Report intake</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Tell us who we're auditing</h1>
        <p className="mt-3 text-muted-foreground">
          This is everything we need. You'll pay on Stripe, then the report starts generating immediately.
        </p>

        {search.canceled ? (
          <div className="mt-6 flex gap-2 rounded-md border border-border bg-secondary px-4 py-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            Checkout was canceled — nothing was charged. Your details are still here.
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-10 space-y-10">
          <fieldset className="space-y-4">
            <Legend n="01" title="Choose your tier" />
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(TIERS) as Tier[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTier(key);
                    void navigate({ to: "/buy", search: { tier: key }, replace: true });
                  }}
                  className={`rounded-md border p-4 text-left transition-colors ${
                    tier === key ? "border-accent bg-accent-soft" : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{TIERS[key].name}</span>
                    <span className="font-display text-lg font-semibold">{TIERS[key].label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {key === "whitelabel"
                      ? "Your agency name and logo on the cover; our branding removed."
                      : "The full report with our methodology page."}
                  </p>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <Legend n="02" title="The brand" />
            <Field label="Brand name" required value={form.brandName} onChange={set("brandName")} maxLength={120} />
            <Field
              label="Brand website"
              required
              value={form.brandWebsite}
              onChange={set("brandWebsite")}
              placeholder="example.com"
              maxLength={200}
            />
            <Field
              label="Industry / niche"
              required
              value={form.industry}
              onChange={set("industry")}
              placeholder="e.g. cosmetic dentistry in Chicago"
              maxLength={160}
            />
            <TextArea
              label="Who is the target customer?"
              required
              value={form.targetCustomer}
              onChange={set("targetCustomer")}
              placeholder="e.g. Adults 30–55 with disposable income researching veneers, comparing 2–3 local clinics before booking a consultation."
              maxLength={1500}
            />
          </fieldset>

          <fieldset className="space-y-4">
            <Legend n="03" title="Competitors (2–3)" />
            <Field label="Competitor 1" required value={form.competitor1} onChange={set("competitor1")} maxLength={120} />
            <Field label="Competitor 2" required value={form.competitor2} onChange={set("competitor2")} maxLength={120} />
            <Field label="Competitor 3 (optional)" value={form.competitor3} onChange={set("competitor3")} maxLength={120} />
          </fieldset>

          {tier === "whitelabel" ? (
            <fieldset className="space-y-4">
              <Legend n="04" title="Your agency branding" />
              <Field
                label="Agency name (appears on the cover)"
                value={form.agencyName}
                onChange={set("agencyName")}
                maxLength={120}
              />
              <div>
                <label className="text-sm font-medium">Agency logo (PNG or JPG, optional)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={onLogo}
                  className="mt-1.5 block w-full rounded-md border border-input bg-card px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium"
                />
                {logo ? <p className="mt-1.5 text-xs text-muted-foreground">Attached: {logo.name}</p> : null}
              </div>
            </fieldset>
          ) : null}

          <fieldset className="space-y-4">
            <Legend n={tier === "whitelabel" ? "05" : "04"} title="Where do we send it?" />
            <Field
              label="Email"
              required
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="you@agency.com"
              maxLength={255}
            />
          </fieldset>

          {error ? (
            <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue to payment — {TIERS[tier].label}
              {!busy ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
            <p className="text-xs text-muted-foreground">Secure checkout by Stripe. One-time charge.</p>
          </div>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}

function Legend({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border pb-2">
      <span className="font-display text-sm text-accent">{n}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-sm font-medium">
        {props.label}
        {props.required ? <span className="text-accent"> *</span> : null}
      </label>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={props.onChange}
        required={props.required ?? false}
        placeholder={props.placeholder ?? ""}
        maxLength={props.maxLength ?? 255}
        className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
      />
    </div>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-sm font-medium">
        {props.label}
        {props.required ? <span className="text-accent"> *</span> : null}
      </label>
      <textarea
        value={props.value}
        onChange={props.onChange}
        required={props.required ?? false}
        placeholder={props.placeholder ?? ""}
        maxLength={props.maxLength ?? 1500}
        rows={4}
        className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
      />
    </div>
  );
}