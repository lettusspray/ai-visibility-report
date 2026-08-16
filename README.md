# AI Visibility Report

Build "VisibilityAudit" — a one-time-purchase AI Search Visibility Report tool for marketing agencies. No subscriptions, no dashboards, no login required for buyers.

FLOW:
1. Landing page: headline about agencies losing clients to competitors in ChatGPT/Gemini/Perplexity answers, explain the deliverable (a done-for-you, white-label-ready PDF report), show a sample report preview, price it at $99 one-time ("Agency Report") with a $149 tier ("Agency Report + White Label" that removes our branding and adds a text field for the agency's own logo/name to appear on the cover).
2. Intake form after clicking Buy: brand name, brand website, 2-3 competitor names, industry/niche, target customer description (free text), agency name + logo upload (optional, only shown if they picked the white-label tier), email.
3. Stripe Checkout for the selected tier, using the seamless Stripe integration.
4. On successful payment, store the submission in Lovable Cloud (Postgres) with status "pending", and kick off report generation:
   - Generate 8-10 realistic buyer-intent questions a customer would ask an AI assistant when shopping in that industry/niche (use the AI gateway, OpenAI model, to generate these based on the industry + target customer description provided).
   - For each question, query it against: OpenAI (via AI gateway), Gemini (via AI gateway), and Perplexity (via the Perplexity connector). Record whether the brand is mentioned, whether each competitor is mentioned, and capture the raw answer text.
   - Feed all results into one more AI gateway call (OpenAI, higher-effort prompt) that acts as a senior AI-visibility consultant: produce an executive summary (brand's visibility % vs each competitor's), a per-platform breakdown, a "why you're losing" analysis referencing specific answer patterns from the data, and 5 prioritized, specific action items.
   - Render this into a clean, professional PDF report: cover page (white-label: agency name/logo if provided, otherwise our branding), executive summary, per-platform breakdown with example AI answer excerpts, the why-analysis, the action items, and a closing page.
5. Email the buyer (use Resend if available, otherwise just show it on a results page) with a link to view/download the PDF once generation completes. Show a "generating your report, this takes about 2 minutes" status page with polling in the meantime.
6. Simple admin view at /admin (password-gated, single shared password stored as a secret) listing all orders with status and a link to view/regenerate each report.

DESIGN: Professional, credible, B2B SaaS aesthetic — not flashy. Should look like something a marketing agency would trust to put in front of their own client. Clean typography, neutral palette with one accent color, no stock-photo cheese.

Keep the initial build focused on this full flow working end to end with real Stripe test-mode checkout and a real generated PDF — polish and edge cases can come after. Use Lovable Cloud for the database, storage (for PDFs and logos), and secrets (Stripe keys, Resend key if used).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f2385f06-2dfa-46d6-89a2-2f06f32d9066).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
