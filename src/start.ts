import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// CSRF protection — inline instead of createCsrfMiddleware (uses
// createIsomorphicFn which resolves to undefined on Cloudflare Workers
// with no_bundle). Only blocks cross-origin submissions that carry an
// Origin/Referer header pointing to a different host.
const csrfMiddleware = createMiddleware().server(async ({ next, request }) => {
  const secFetchSite = request.headers.get("Sec-Fetch-Site");
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");

  // Safe: same-origin / same-site navigations (browser always sets this).
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") return next();

  // Safe: "none" = direct navigation (address bar, bookmark) or top-level reload.
  if (secFetchSite === "none") return next();

  // If there's an Origin header, verify it matches the request host.
  if (origin) {
    try {
      if (new URL(origin).host === new URL(request.url).host) return next();
    } catch { /* malformed — fall through to reject */ }
  }

  // If there's a Referer but no/invalid Origin, verify the referer host.
  if (referer) {
    try {
      if (new URL(referer).host === new URL(request.url).host) return next();
    } catch { /* malformed — fall through to reject */ }
  }

  // No origin/referer at all (e.g. curl, privacy headers) — safe for
  // GET-like navigations; CSRF attacks always carry an origin.
  if (!origin && !referer) return next();

  // Cross-origin submission — block.
  return new Response("CSRF validation failed", { status: 403 });
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
