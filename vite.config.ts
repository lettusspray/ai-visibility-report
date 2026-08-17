// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

/**
 * TanStack's createCsrfMiddleware uses createIsomorphicFn().server(fn) which
 * resolves to `undefined` on Cloudflare Workers with no_bundle — the runtime
 * wrapper function loaded via separate module files can't be called.
 *
 * This plugin replaces createRuntimeFn so it always returns the server
 * implementation when invoked, bypassing the isomorphic dispatch.
 */
function fixIsomorphicFnOnCloudflare(): Plugin {
  return {
    name: "fix-isomorphic-fn-cloudflare",
    enforce: "post",
    apply: "build",
    transform(code: string, id: string) {
      if (!id.includes("start-fn-stubs") || !id.includes("createIsomorphicFn")) return null;

      // Replace createRuntimeFn so the returned function IS the impl (not a wrapper).
      const patched = code.replace(
        `function createRuntimeFn(fn, serverImpl) {
\treturn Object.assign(fn, {
\t\tserver: (nextServerImpl) => {
\t\t\treturn createRuntimeFn(nextServerImpl, nextServerImpl);
\t\t},
\t\tclient: (clientImpl) => {
\t\t\treturn createRuntimeFn(serverImpl ?? clientImpl, serverImpl);
\t\t}
\t});
}`,
        `function createRuntimeFn(fn, serverImpl) {
\tconst impl = serverImpl ?? fn;
\treturn Object.assign(impl, {
\t\tserver: (nextServerImpl) => {
\t\t\treturn createRuntimeFn(nextServerImpl, nextServerImpl);
\t\t},
\t\tclient: (clientImpl) => {
\t\t\treturn createRuntimeFn(serverImpl ?? clientImpl, serverImpl);
\t\t}
\t});
}`,
      );
      if (patched !== code) return { code: patched, map: null };
      return null;
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  // Inline all dynamic imports into a single SSR file to eliminate circular
  // chunk dependencies that break on Cloudflare Workers (no_bundle or bundled).
  nitro: {
    rollupConfig: {
      output: { inlineDynamicImports: true },
    },
  } as any,
  plugins: [fixIsomorphicFnOnCloudflare()],
});
