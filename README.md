# Mercercroft

AI visibility tracking for brands. Monitor how ChatGPT, Gemini, Perplexity and DeepSeek recommend your business, track sentiment and keywords over time, and get clear actions to improve.

Contact: hi@mercercroft.com

## Stack

- **Frontend/SSR**: TanStack Start + React 19 + Vite
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL + RLS + Auth + Storage)
- **Billing**: Paystack
- **Collection**: Browser Use Cloud hosted agents (no AI provider APIs for collection)
- **Analysis LLM**: DeepSeek v4-flash
- **PDF**: pdf-lib
- **Deploy target**: Cloudflare Workers via Nitro

## Prerequisites

- Node.js 22+
- A Supabase project (database, auth, storage)
- A Browser Use Cloud account (API keys for browser automation)
- A DeepSeek API key (for analysis/generation)
- A Paystack account (for billing)
- Cloudflare account (for deployment)
- Wrangler CLI: `npm i -g wrangler`

## Environment Variables

### Client-side (Vite build-time, prefixed `VITE_`)

| Variable                        | Description                   |
| ------------------------------- | ----------------------------- |
| `VITE_SUPABASE_URL`             | Supabase project URL          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |

Set these in `.env` for local dev:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### Server-side (Cloudflare Workers runtime secrets)

| Variable                    | Required | Description                              |
| --------------------------- | -------- | ---------------------------------------- |
| `SUPABASE_URL`              | Yes      | Same as `VITE_SUPABASE_URL`              |
| `SUPABASE_PUBLISHABLE_KEY`  | Yes      | Same as `VITE_SUPABASE_PUBLISHABLE_KEY`  |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Supabase service role key (bypasses RLS) |
| `BROWSER_USE_API_KEYS`      | Yes      | Comma-separated Browser Use API keys     |
| `BROWSER_USE_MODEL`         | No       | Default `gpt-5.6-luna`                   |
| `BROWSER_USE_PROXY_COUNTRY` | No       | Proxy country code                       |
| `DEEPSEEK_API_KEY`          | Yes      | DeepSeek API key for analysis            |
| `PAYSTACK_SECRET_KEY`       | Yes      | Paystack secret key                      |
| `PAYSTACK_PLAN_STARTER`     | Yes      | Paystack plan code for Starter           |
| `PAYSTACK_PLAN_PRO`         | Yes      | Paystack plan code for Pro               |
| `ADMIN_PASSWORD`            | Yes      | Password for `/admin`                    |

## Local Development

```sh
git clone git@github.com:lettusspray/ai-visibility-report.git
cd ai-visibility-report
npm install
cp .env.example .env   # fill in VITE_ vars
npm run dev
```

The dev server runs on `http://localhost:3000`.

For server-side env vars in local dev, create a `.dev.vars` file (Cloudflare convention):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...
BROWSER_USE_API_KEYS=bu_...
DEEPSEEK_API_KEY=...
PAYSTACK_SECRET_KEY=...
PAYSTACK_PLAN_STARTER=...
PAYSTACK_PLAN_PRO=...
ADMIN_PASSWORD=...
```

## Database Migrations

Run Supabase migrations from `supabase/migrations/`:

```sh
# Via Supabase CLI (if installed)
supabase db push

# Or apply manually via the Supabase dashboard SQL editor
```

Key tables: `profiles`, `brands`, `tracked_queries`, `snapshots`, `brand_products`, `brand_facts`, `brand_keywords`.

## Build & Deploy

### Cloudflare Workers

```sh
npm run build
npx wrangler deploy
```

Set secrets on Cloudflare:

```sh
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put BROWSER_USE_API_KEYS
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put PAYSTACK_SECRET_KEY
npx wrangler secret put PAYSTACK_PLAN_STARTER
npx wrangler secret put PAYSTACK_PLAN_PRO
npx wrangler secret put ADMIN_PASSWORD
```

Client-side env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) must be set at build time. In the **Cloudflare dashboard** (Workers & Pages > your worker > Settings > Variables):

1. Under **Build variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your Supabase publishable/anon key
2. Under **Secrets** (Runtime), add all server-side vars listed above

Or pass them inline when building locally:

```sh
VITE_SUPABASE_URL=https://your-project.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
npm run build
```

### Custom Domain

1. In the Cloudflare dashboard, go to Workers & Pages > your worker > Settings > Domains & Routes
2. Add your custom domain (e.g. `mercercroft.com`)
3. Update `og:url` and canonical links in `src/routes/__root.tsx` and `src/routes/index.tsx`
4. Update `Sitemap:` in `public/robots.txt` and URLs in `public/sitemap.xml`

## Architecture

- File-based routing in `src/routes/`
- Server logic in `src/lib/*.server.ts` and `*.functions.ts`
- `src/server.ts` is the SSR error wrapper (Nitro entry)
- `src/start.ts` configures CSRF + auth middleware (don't delete)
- Dashboard is the primary report view; PDF is an optional export
- Nothing is emailed — no email infrastructure

## Key Flows

### Snapshot Pipeline

1. User triggers snapshot → `startSnapshot` inserts DB row
2. `runSnapshot` generates buyer questions (mapped to brand keywords)
3. Each question is sent to every available engine via Browser Use agents
4. Results are scored: brand mentions, citations, product mentions, keyword visibility, sentiment
5. Two-pass LLM analysis: grounded draft with footnotes, then editing pass
6. PDF rendered and uploaded to Supabase storage
7. Dashboard polls for completion

### Engine Availability

- **ChatGPT** and **Perplexity**: work without login (logged-out sessions)
- **DeepSeek**: works without login
- **Gemini, Claude, Meta AI, Grok**: require a saved Browser Use profile (M2)
- Engines without credentials are silently skipped (not errors)

## License

Proprietary. All rights reserved.
