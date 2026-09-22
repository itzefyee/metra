# Metra

> AI-assisted CAD generation, drawing analysis, and industrial components catalog — built on Convex.

**Live app:** <https://tremendous-crow-16.convex.site>  
**Hackathon:** [HACKATHON.md](HACKATHON.md)

---

## Architecture

```
Browser
  → Next.js static export (out/)
  → Convex Static Hosting (https://<deployment>.convex.site)
       → /api/*  Convex HTTP actions
            → Convex database + file storage
            → Azure OpenAI / Zoo Dev / Upstash Redis  (server-side only)
```

---

## Local development

Prerequisites: Node.js 20+ and a Convex account.

```powershell
# Terminal 1 — Convex backend (creates .env.local automatically)
npm ci
npx convex dev

# Terminal 2 — Next.js dev server
npm run dev
```

---

## Configuration

All secrets live in the **Convex deployment environment** — never in frontend code.  
Set them with `npx convex env set <KEY> <VALUE>` or via the dashboard.

| Variable | Purpose |
|----------|---------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI credential |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Model name (`gpt-4.1-mini`) |
| `ZOO_DEV_API_KEY` | Zoo Dev / KittyCAD CAD generation |
| `UPSTASH_REDIS_REST_URL` | Upstash rate-limit store |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash credential |

`NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` are public — they are embedded in the browser bundle.

---

## Seeding catalog data

```powershell
npm run migrate:import-products

# Target production explicitly:
$env:METRA_CONVEX_TARGET = "prod"
npm run migrate:import-products
Remove-Item Env:METRA_CONVEX_TARGET
```

---

## Deploying to production

> **Important:** `npm run deploy` rebuilds the frontend with `.env.local` (dev URLs) before uploading. Always use the steps below to bake prod URLs into the bundle.

```powershell
# 1. Push Convex functions to production
npx convex deploy --yes

# 2. Build frontend with production URLs baked in
$env:NEXT_PUBLIC_CONVEX_URL="https://tremendous-crow-16.convex.cloud"
$env:NEXT_PUBLIC_CONVEX_SITE_URL="https://tremendous-crow-16.convex.site"
npm run build

# 3. Upload static files to the production deployment
$env:CONVEX_DEPLOYMENT="prod:tremendous-crow-16"
npx @convex-dev/static-hosting upload --dist out
```

---

## References

- [Convex docs](https://docs.convex.dev/)
- [Convex Static Hosting](https://www.npmjs.com/package/@convex-dev/static-hosting)
- [Zoo Dev / KittyCAD](https://zoo.dev)
- [Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/latest)
