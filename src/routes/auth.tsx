import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/site-header";
import { SunBehindCloudMark } from "@/components/weather";

type Search = { mode?: "login" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    mode: search["mode"] === "signup" ? "signup" : "login",
  }),
  head: () => ({
    meta: [
      { title: "Log in or create an account — Mercercroft" },
      { name: "description", content: "Sign in to Mercercroft to track how AI assistants recommend your business." },
      { property: "og:title", content: "Log in to Mercercroft" },
      { property: "og:description", content: "Access your AI visibility dashboard, forecast and reports." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (isSignup) {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (err) throw err;
        const { data } = await supabase.auth.getSession();
        if (data.session) navigate({ to: "/dashboard" });
        else setMessage("Check your inbox to confirm your email, then log in.");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <Logo />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-20">
        <div className="cloud-card p-8">
          <SunBehindCloudMark className="h-10 w-10 text-accent" />
          <h1 className="mt-4 text-2xl font-semibold">{isSignup ? "Start with a free snapshot" : "Welcome back"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup
              ? "One report a month, free. No card needed."
              : "Log in to see your current conditions and forecast."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.com"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "One moment…" : isSignup ? "Create account" : "Log in"}
            </button>
          </form>

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}

          <button
            type="button"
            onClick={() => setIsSignup((v) => !v)}
            className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {isSignup ? "Already have an account? Log in" : "New here? Create a free account"}
          </button>
        </div>
        <Link to="/" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">
          Back to home
        </Link>
      </main>
    </div>
  );
}
