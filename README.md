# Metra

> AI-assisted CAD generation, drawing analysis, and industrial components catalog — built on Convex.

**Live app:** <https://tremendous-crow-16.convex.site>  
**Hackathon submission:** [HACKATHON.md](HACKATHON.md)

---

## Architecture

```text
Browser
  -> Next.js static export (out/)
  -> Convex Static Hosting (https://<deployment>.convex.site)
       -> /api/* Convex HTTP actions
            -> Convex database and file storage
            -> Azure OpenAI / Zoo Dev / Upstash Redis (server-side only)
```

The static site is delivered by Convex. All AI provider keys and Redis credentials live exclusively in Convex environment settings — never in the browser bundle.

---

## Local development

Prerequisites: Node.js 20+ and a Convex account.

```powershell
npm ci
npx convex dev
```

In a second terminal:

```powershell
npm run dev
```

`npx convex dev` creates `.env.local` with `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`. Use the Next.js dev server for local work; static hosting is the release target.

---

## Configuration

Set all secrets in the **Convex deployment environment** (dashboard or `npx convex env set`), not in frontend code.

| Variable | Purpose |
|----------|---------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI credential |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Model deployment name (`gpt-4.1-mini`) |
| `ZOO_DEV_API_KEY` | Zoo Dev CAD generation credential |
| `UPSTASH_REDIS_REST_URL` | Upstash rate-limit store URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash credential |

`NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` are public by design — they are embedded in the browser bundle.

---

## Seeding catalog data

```powershell
npm run migrate:import-products
```

To target production explicitly:

```powershell
$env:METRA_CONVEX_TARGET = "prod"
npm run migrate:import-products
Remove-Item Env:METRA_CONVEX_TARGET
```

---

## Deploying

### 1. Push Convex backend

```powershell
npx convex deploy --yes
```

### 2. Build frontend with production URLs

```powershell
$env:NEXT_PUBLIC_CONVEX_URL="https://tremendous-crow-16.convex.cloud"
$env:NEXT_PUBLIC_CONVEX_SITE_URL="https://tremendous-crow-16.convex.site"
npm run build
```

### 3. Upload static files to production

```powershell
$env:CONVEX_DEPLOYMENT="prod:tremendous-crow-16"
npx @convex-dev/static-hosting upload --dist out
```

> **Note:** Do not use `npm run deploy` directly — it rebuilds the frontend with `.env.local` (dev URLs) before uploading, overwriting the prod build.

---

## References

- [Convex documentation](https://docs.convex.dev/)
- [Convex Static Hosting](https://www.npmjs.com/package/@convex-dev/static-hosting)
- [Zoo Dev (KittyCAD)](https://zoo.dev)
- [Azure OpenAI documentation](https://learn.microsoft.com/en-us/azure/foundry/openai/latest)
