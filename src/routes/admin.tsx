import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { adminListOrders, adminMarkPaidAndStart, adminRegenerate } from "@/lib/orders.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — VisibilityAudit" },
      { name: "description", content: "Internal order console for VisibilityAudit reports." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin — VisibilityAudit" },
      { property: "og:description", content: "Internal order console." },
    ],
  }),
  component: Admin,
});

type Order = Awaited<ReturnType<typeof adminListOrders>>[number];

function Admin() {
  const list = useServerFn(adminListOrders);
  const regen = useServerFn(adminRegenerate);
  const markPaid = useServerFn(adminMarkPaidAndStart);

  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(pw: string) {
    setBusy(true);
    setError(null);
    try {
      setOrders(await list({ data: { password: pw } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: typeof regen, orderId: string) {
    setBusy(true);
    try {
      await fn({ data: { password, orderId, origin: window.location.origin } });
      await load(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-14">
        <h1 className="text-3xl font-semibold">Orders</h1>

        {!orders ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(password);
            }}
            className="panel mt-8 max-w-sm space-y-4 p-6"
          >
            <label className="block text-sm font-medium">Admin password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sign in
            </button>
          </form>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => void load(password)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh
              </button>
              {error ? <span className="text-sm text-destructive">{error}</span> : null}
            </div>

            <div className="panel mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    {["Created", "Brand", "Email", "Tier", "Payment", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(o.created_at as string).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium">{o.brand_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{o.email}</td>
                      <td className="px-4 py-3">{o.tier === "whitelabel" ? "White label" : "Standard"}</td>
                      <td className="px-4 py-3">{o.payment_status}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{o.status}</span>
                        {o.error_message ? (
                          <div className="mt-1 max-w-xs text-xs text-destructive">{o.error_message}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 text-xs">
                          <a href={`/report/${o.access_token}`} className="text-accent underline">
                            View
                          </a>
                          <button onClick={() => void act(regen, o.id)} className="underline">
                            Regenerate
                          </button>
                          {o.payment_status !== "paid" ? (
                            <button onClick={() => void act(markPaid, o.id)} className="underline">
                              Mark paid + run
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}