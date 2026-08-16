import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Logo } from "@/components/site-header";
import { adminOverview, adminRegenerate } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — Mercercroft" },
      { name: "description", content: "Internal Mercercroft admin view for accounts, plans and snapshot runs." },
      { property: "og:title", content: "Admin — Mercercroft" },
      { property: "og:description", content: "Internal admin view." },
    ],
  }),
  component: Admin,
});

type Overview = Awaited<ReturnType<typeof adminOverview>>;

function Admin() {
  const overview = useServerFn(adminOverview);
  const regenerate = useServerFn(adminRegenerate);
  const [password, setPassword] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(pw: string) {
    setError(null);
    try {
      setData(await overview({ data: { password: pw } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load.");
    }
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <form
          onSubmit={(e) => { e.preventDefault(); load(password); }}
          className="cloud-card w-full max-w-sm p-8"
        >
          <Logo />
          <h1 className="mt-5 text-xl font-semibold">Admin access</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Shared password"
            className="mt-4 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
          />
          <button className="mt-4 w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Enter</button>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <button onClick={() => load(password)} className="text-sm text-muted-foreground hover:text-foreground">Refresh</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {[["Accounts", data.totals.accounts], ["Paid accounts", data.totals.paid], ["Recent snapshots", data.totals.snapshots]].map(([label, value]) => (
            <div key={label as string} className="cloud-card p-6">
              <p className="text-eyebrow">{label}</p>
              <p className="font-display text-4xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-xl font-semibold">Accounts</h2>
        <div className="cloud-card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="text-muted-foreground">
              <tr><th className="p-3">Email</th><th className="p-3">Plan</th><th className="p-3">Status</th><th className="p-3">Reports</th><th className="p-3">Brands</th></tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.id} className="border-t border-border/70">
                  <td className="p-3">{a.email}</td>
                  <td className="p-3">{a.plan}</td>
                  <td className="p-3 text-muted-foreground">{a.subscription_status}</td>
                  <td className="p-3">{a.reports_this_period}</td>
                  <td className="p-3 text-muted-foreground">{a.brands.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-xl font-semibold">Recent snapshots</h2>
        <div className="cloud-card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="text-muted-foreground">
              <tr><th className="p-3">Brand</th><th className="p-3">Status</th><th className="p-3">Visibility</th><th className="p-3">Created</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {data.snapshots.map((s) => (
                <tr key={s.id} className="border-t border-border/70">
                  <td className="p-3">{s.brandName}</td>
                  <td className="p-3">{s.status}{s.error_message ? ` — ${s.error_message}` : ""}</td>
                  <td className="p-3">{s.brand_visibility != null ? `${Math.round(s.brand_visibility)}%` : "—"}</td>
                  <td className="p-3 text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    <button onClick={() => regenerate({ data: { password, snapshotId: s.id } })} className="rounded-full border border-input px-4 py-1.5 text-xs hover:bg-secondary">
                      Regenerate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
