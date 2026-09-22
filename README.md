# Metra

Metra is an AI-assisted CAD and components-catalog prototype. Its Next.js
frontend is exported as static files and hosted directly by Convex at a
`convex.site` URL; Convex also hosts the application API under `/api`.

## Architecture

```text
Browser
  -> Next.js static export (`out/`)
  -> Convex Static Hosting (`https://<deployment>.convex.site`)
       -> /api/* Convex HTTP actions
            -> Convex database and file storage
            -> Azure OpenAI / Zoo Dev / Upstash Redis (server-side only)
```

The static site is delivered by Convex. Azure OpenAI and Upstash are used only
by server-side Convex actions.

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

Use the normal Next.js development server for local work. Static Hosting is
the release target, not a replacement for hot reload.

## Configuration and secrets

`npx convex dev` creates the ignored local Convex configuration. Do not commit
`.env*` files, deployment metadata, browser profiles, or export files.

Set service credentials in the relevant **Convex deployment environment**, not
in frontend code or a separate hosting environment:

| Variable | Purpose | Required for |
| --- | --- | --- |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint | Azure-backed AI actions |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI credential | Azure-backed AI actions |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Azure model deployment name | Chat and vision actions |
| `ZOO_DEV_API_KEY` | Zoo Dev CAD generation credential | CAD generation |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash rate limiting and optional caching | Public, cost-bearing endpoints |
Use a chat-completions-compatible deployment that supports image input if
drawing analysis is enabled. Configure all provider secrets through the
authenticated Convex CLI or dashboard, never in tracked files or browser code.

See [deployment operations](docs/DEPLOYMENT.md) and
[security guidance](docs/SECURITY.md) for the release checklist.

## Catalog data

The committed JSON files in `scripts/migration-data/` are seed catalog
fixtures. Import them into the active development deployment with:

```powershell
npm run migrate:import-products
```

To target the production deployment intentionally:

```powershell
$env:METRA_CONVEX_TARGET = "prod"
npm run migrate:import-products
Remove-Item Env:METRA_CONVEX_TARGET
```

The importer uses authenticated internal Convex mutations and upserts the
catalog records. It is not a tool for copying users, sessions, CAD files, or
other private production data. Local exports belong in
`scripts/migration-data/convex-export/`, which is deliberately ignored.

See [data import guidance](docs/DATA_IMPORT.md).

## Deploying

Build and smoke-test the development static site first:

```powershell
npm run build
npm run deploy:static:dev
```

Then deploy the Convex backend and static frontend together:

```powershell
npm run deploy
```

The command prints the resulting `https://<deployment>.convex.site` URL.

## Public-repository safety

This repository is intended to be public. Before committing or publishing:

- Keep `.env*`, `.devseccode/`, `node_modules/`, build output, and private
  migration exports untracked.
- Treat `NEXT_PUBLIC_*` values as public: anything with that prefix can be
  embedded in the browser bundle.
- Keep provider keys only in Convex environment settings.
- Review staged changes for credentials and private catalog/user exports.
- Do not migrate account, session, file-storage, or generation records from
  a previous environment without a dedicated privacy review.

## Current production gates

Metra has server-side provider integration, input validation, internal catalog
writes, and per-generation capability URLs. It is still a prototype and should
not be treated as a fully authenticated public service until the following are
in place:

- A managed Convex authentication solution and server-enforced ownership for
  every private resource.
- Upstash rate limiting (or an equivalent) for all cost-bearing anonymous
  routes before enabling paid provider credentials.
- Authentication and abuse controls for file uploads and drawing analysis.
- Provider spending limits, monitoring, and incident response procedures.

The current custom account layer uses scrypt password hashes and stores only
hashed session tokens in Convex, but its browser-held session token is not a
replacement for cookie-based, managed authentication.

## References

- [Convex documentation](https://docs.convex.dev/)
- [Convex Static Hosting](https://www.npmjs.com/package/@convex-dev/static-hosting)
- [Azure OpenAI chat-completions documentation](https://learn.microsoft.com/en-us/azure/foundry/openai/latest)
