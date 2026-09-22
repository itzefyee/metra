# Security and public-repository guidance

## Secrets

Provider credentials belong only in Convex environment settings. In particular,
do not put `AI_GATEWAY_API_KEY`, `ZOO_DEV_API_KEY`, Redis tokens, or any
provider credential in:

- a `NEXT_PUBLIC_*` variable;
- `.env.example`, documentation, source code, or Git history;
- a separate hosting environment; or
- client-side requests.

`npx vercel ai-gateway setup --agent codex` prepares local developer tooling.
It does not remove the need to configure `AI_GATEWAY_API_KEY` safely in Convex
for deployed actions.

## Public data versus private data

The product catalog is intentionally readable by the public frontend. Catalog
writes and account database helpers are internal Convex functions. CAD results
use a random per-generation capability that is retained in the local browser;
it is an isolation measure, not a substitute for authenticated authorization.

Do not publish user data, session data, file exports, generated CAD files, or
service logs. The repository ignores `.env*`, `.devseccode/`, and local
Convex-export data for this reason.

## Deployment controls

Before enabling paid AI or CAD credentials on a broadly public site:

1. Configure a real identity provider and enforce ownership server-side.
2. Configure rate limiting for CAD, chat, and analysis actions.
3. Require authentication and abuse controls for file upload and analysis.
4. Set provider budgets/alerts and test credential rotation.
5. Review the staged diff and run a secret scan before every public push.

The current email/password account experience hashes passwords with scrypt and
stores a hash of each session token in Convex. Because the raw session token is
held by the browser, this prototype should be upgraded to managed Convex Auth
or another cookie-based authentication system before production use.
