"use node";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitOptions = {
  key: string;
  prefix: string;
  limit: number;
  window: "1 h";
};

/**
 * Cost-bearing endpoints fail closed when their server-side limiter is absent.
 * This avoids accidentally enabling paid providers without abuse controls.
 */
export async function enforceRateLimit(options: RateLimitOptions): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for cost-bearing actions.",
    );
  }

  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(options.limit, options.window),
    analytics: true,
    prefix: options.prefix,
  });
  const { success } = await limiter.limit(options.key);
  if (!success) {
    throw new Error("Rate limit exceeded");
  }
}
