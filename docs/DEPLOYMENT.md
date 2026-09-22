# Deploying Metra on Convex Static Hosting

Metra has one application deployment target: Convex. The static Next.js export
is served from `https://<deployment>.convex.site`, and the custom HTTP API is
mounted under `/api`. There is no additional static-hosting deployment.

## Before a release

1. Log in to the intended Convex account and select the right deployment.
2. Configure server-only secrets in that Convex deployment:
   `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, and
   `AZURE_OPENAI_DEPLOYMENT_NAME` for AI work; `ZOO_DEV_API_KEY` for CAD
   generation; and the Upstash URL/token for cost-bearing endpoints.
3. Confirm no secret is present in `.env*`, source code, build output, or the
   staged Git diff.
4. Run the local quality checks that apply to the change, including:

   ```powershell
   npx convex dev --once
   npm run build
   npm run lint
   ```

## Hosted development smoke test

Upload a build to the active development deployment:

```powershell
npm run deploy:static:dev
```

This builds `out/` and uploads it to Convex Static Hosting. Use the emitted
`convex.site` URL to verify the landing page, static assets, a deep link, and
the `/api` routes before production.

## Production release

```powershell
npm run deploy
```

The configured command uses `@convex-dev/static-hosting` to build the frontend,
deploy Convex functions, and upload the static output atomically. Save the
printed `convex.site` URL in the release record.

After deployment, smoke-test:

- `/` and at least one deep-linked page after a browser refresh;
- a public catalog query;
- API routing at `/api`;
- authenticated administrative access only after real application auth is
  enabled; and
- no browser bundle contains provider credentials.

## Azure OpenAI

Metra calls Azure OpenAI's v1 chat-completions endpoint from Convex actions.
Use the Azure deployment name—not a public model label—for
`AZURE_OPENAI_DEPLOYMENT_NAME`. The deployment must support vision for drawing
analysis. Rotate Azure credentials in the Convex environment and validate an
AI action; no separate static-site deploy is required.

## Rollback

If a release fails verification, first stop exposing or rotate any affected
provider credential. Then deploy the last known-good Git revision with the
same Convex Static Hosting command. Do not recover a release by committing a
local `.env` file or copying production data into the repository.
