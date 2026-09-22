# Convex All Gas Hackathon — Metra Submission

> **Hackathon:** [Convex All Gas Hackathon](https://www.convex.dev/hackathons/all-gas)  
> **Event page:** <https://lu.ma/convex-allgas-hackathon>  
> **Live app:** <https://tremendous-crow-16.convex.site>  
> **Convex dashboard:** <https://dashboard.convex.dev/t/e-fye-ching/metra-c6e0d/tremendous-crow-16>

---

## What we built

**Metra** is an AI-assisted CAD and industrial components platform for the structural steel and fabrication industry. It lets engineers:

- **Generate CAD models from plain-English descriptions** — type "6×4 inch A36 steel bracket, ¼ inch thick, 4 mounting holes" and receive a downloadable STEP file with an in-browser 3D preview.
- **Analyse uploaded drawings** — drag in a STEP, STL, OBJ, DXF, PNG, or JPG file for AI-powered structural and compliance analysis (AISC 360-16, AWS D1.1, ASME Y14.5).
- **Browse and search the product catalog** — filterable steel components with AI-matched recommendations.
- **Request quotes** — B2B RFQ flow with contact info, material/process selection, and batch quantity.
- **Chat with a Metra AI assistant** — powered by Azure OpenAI, rate-limited via Upstash Redis.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (static export), React, TailwindCSS |
| **Backend / DB / hosting** | [Convex](https://convex.dev) — database, file storage, HTTP actions, static site hosting |
| **AI — text & chat** | Azure OpenAI (`gpt-4.1-mini`) via Convex actions |
| **AI — CAD generation** | [Zoo Dev / KittyCAD](https://zoo.dev) text-to-CAD API |
| **3D preview** | THREE.js + OpenCascade.js (WASM) — parses STEP/STL/OBJ in the browser |
| **Rate limiting** | Upstash Redis (sliding-window, server-side only) |
| **State management** | Zustand + TanStack React Query |

---

## How Convex is used

Convex is the backbone of the entire stack:

- **Database** — `cadGenerations`, `drawingAnalyses`, `products`, `users`, `sessions` tables with indexes.
- **File storage** — generated STEP files are stored in Convex and served back via signed storage URLs.
- **HTTP actions** — all API endpoints (`/api/cad/generate`, `/api/cad/download/:id`, `/api/mcp/chat`, etc.) run as Convex HTTP actions, keeping API keys server-side.
- **Static hosting** — the Next.js `out/` build is uploaded directly to Convex via `@convex-dev/static-hosting`, so the entire app (frontend + backend + file storage) lives in one Convex deployment.
- **Internal actions & mutations** — CAD generation, drawing analysis, product scoring, and rate-limit enforcement all run inside Convex actions.

---

## Sponsor tech used

| Sponsor | How |
|---------|-----|
| **Convex** | Database, file storage, HTTP actions, static hosting — the entire backend |
| **OpenAI** (via Azure) | GPT-4.1 Mini for chat, drawing analysis, and product recommendations |

---

## Running locally

```powershell
# 1. Install dependencies
npm ci

# 2. Start Convex dev server (creates .env.local with CONVEX_DEPLOYMENT)
npx convex dev

# 3. In a second terminal, start Next.js dev server
npm run dev
```

See [`README.md`](README.md) for the full configuration table and deployment instructions.

---

## Deploying to production

```powershell
# Push Convex functions to prod
npx convex deploy --yes

# Build frontend with prod URLs baked in
$env:NEXT_PUBLIC_CONVEX_URL="https://tremendous-crow-16.convex.cloud"
$env:NEXT_PUBLIC_CONVEX_SITE_URL="https://tremendous-crow-16.convex.site"
npm run build

# Upload static files to prod Convex deployment
$env:CONVEX_DEPLOYMENT="prod:tremendous-crow-16"
npx @convex-dev/static-hosting upload --dist out
```

---

## Team

Built solo for the Convex All Gas Hackathon.

