#!/usr/bin/env node
// Reads .env, injects non-VITE_ vars into .output/server/wrangler.json "vars"
// so `wrangler deploy` pushes them as Cloudflare Worker env vars.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const wranglerPath = resolve(root, ".output/server/wrangler.json");

let envText;
try {
  envText = readFileSync(envPath, "utf8");
} catch {
  console.log("[inject-env] No .env found, skipping.");
  process.exit(0);
}

const env = {};
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  // strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const serverVars = {};
for (const [k, v] of Object.entries(env)) {
  if (k.startsWith("VITE_")) continue;
  serverVars[k] = v;
}

if (Object.keys(serverVars).length === 0) {
  console.log("[inject-env] No server-side vars to inject.");
  process.exit(0);
}

let wrangler;
try {
  wrangler = JSON.parse(readFileSync(wranglerPath, "utf8"));
} catch {
  console.error("[inject-env] Could not read", wranglerPath);
  process.exit(1);
}

wrangler.vars = { ...wrangler.vars, ...serverVars };

writeFileSync(wranglerPath, JSON.stringify(wrangler, null, 2) + "\n");
console.log(
  `[inject-env] Injected ${Object.keys(serverVars).length} var(s) into wrangler.json: ${Object.keys(serverVars).join(", ")}`
);
