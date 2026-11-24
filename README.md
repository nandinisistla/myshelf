# MyShelf

**Skincare apps tell you what's in a product. MyShelf helps you figure out what's actually breaking out *your* skin.**

A personal skincare shelf that connects the dots between your products, their ingredients and the days your skin acts up.

## What it does

- **My Shelf**: your products as real-looking bottles on shelves you name (your routines). Hover, or press and hold on a phone, to turn a bottle and see its back label.
- **Add by name**: type a product name. The app finds it in Open Beauty Facts and uses AI (Claude with web search) to find the real ingredient list, then explains every ingredient in plain words for your skin. You check it before saving.
- **Almost no logging**: the app knows what you use from your shelf. You only tap **Skin's acting up** on bad days.
- **History**: a timeline of what you used and when your skin reacted. Tap a bad day to see what you used in the 7 days before it. Every change (by you or the AI) is recorded.
- **For me**: ingredient families that keep showing up before your bad days, with the evidence and how sure it is. The counts are plain code (exact); the AI only writes the explanation; you agree, reject or mark "not sure".
- **Ask AI**: a chat assistant that makes changes for you ("my scalp itched yesterday", "add my Anua niacinamide serum", or a photo of a label).

## How it's built

- Plain HTML, CSS and JavaScript (no build step), in `public/`
- Vercel serverless functions in `api/`
- Neon Postgres database (free plan) for everything: products, shelves, bad days, history, chat, findings
- Anthropic API (Claude) for ingredient lookup, explanations and the chat. The key stays on the server.

## Deploy on Vercel

1. **Import** this repository in Vercel (Add New → Project) and click **Deploy**.
2. **Database**: in the project, open **Storage → Create Database → Neon (Postgres)** → connect it to this project. This adds `DATABASE_URL` automatically. Tables are created on first load.
3. **Environment variables** (Settings → Environment Variables):
   - `ANTHROPIC_API_KEY`: your Anthropic API key (required for AI features)
   - `OWNER_KEY`: a passcode for the owner tools (save backup / reset to backup)
   - Optional: `DAILY_AI_LIMIT` (default 120 AI requests per day), `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`)
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variables take effect.

Tip: set a monthly spending limit in the Anthropic console too.

## Run locally (optional)

```bash
npm install
# with a real database:
DATABASE_URL=postgres://... ANTHROPIC_API_KEY=... node dev/server.mjs
# or fully offline with fake AI and an in-memory database:
npm install --no-save @electric-sql/pglite
LOCAL_PGLITE_PATH=$(pwd)/node_modules/@electric-sql/pglite/dist/index.js MOCK_AI=1 node dev/server.mjs
```

Then open http://localhost:3000.

## Notes

- Bottle photos come from Open Beauty Facts (openly licensed, credited) or your own photos. Otherwise the app draws a clean bottle in the product's colours, without copying any brand's logo or packaging.
- MyShelf finds patterns, not diagnoses. For allergies, a dermatologist can do a patch test.
