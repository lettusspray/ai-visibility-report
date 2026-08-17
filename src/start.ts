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
// when no_bundle is set).
const csrfMiddleware = createMiddleware().server(async ({ next, request }) => {
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  const secFetchSite = request.headers.get("Sec-Fetch-Site");

  // Same-origin navigations are always safe.
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") {
    return next();
  }

  // Check Origin header first, then Referer.
  const checkUrl = origin || referer;
  if (checkUrl) {
    try {
      const host = new URL(request.url).host;
      const checkHost = new URL(checkUrl).host;
      if (host === checkHost) return next();
    } catch {
      // malformed header — reject
    }
  }

  // Cross-site request without valid origin — block.
  return new Response("CSRF validation failed", { status: 403 });
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
