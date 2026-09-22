# Redis and rate limiting

Metra can use Upstash Redis from Convex actions for rate limiting and selected
cache paths. Configure `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` in the relevant Convex deployment environment.

Do not put either value in browser code, a `NEXT_PUBLIC_*` variable, or a
static-site build environment. The frontend is hosted by Convex Static Hosting.

Some development paths degrade when Redis is absent. That is acceptable only
for controlled local experimentation. Before enabling paid AI/CAD providers on
a public deployment, configure Redis or an equivalent server-side limiter and
verify the limits in Convex logs.
