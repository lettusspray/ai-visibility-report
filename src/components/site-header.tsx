import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-sm bg-primary text-primary-foreground">
            <span className="font-display text-sm font-semibold">V</span>
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight">VisibilityAudit</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <a href="/#sample" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block">
            Sample report
          </a>
          <a href="/#pricing" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block">
            Pricing
          </a>
          <Link
            to="/buy"
            search={{ tier: "standard" }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Order a report
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} VisibilityAudit. One-time reports. No subscriptions.</p>
        <Link to="/admin" className="transition-colors hover:text-foreground">
          Admin
        </Link>
      </div>
    </footer>
  );
}