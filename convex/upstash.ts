"use node";

import { Ratelimit } from "@upstash/ratelimit";
import * as upstashRatelimit from "@upstash/ratelimit";
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
 * Cost-bearing endpoints enforce rate limits via Upstash Redis.
 * Supports both @upstash/ratelimit and direct Redis fallback.
 */
export async function enforceRateLimit(options: RateLimitOptions): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for cost-bearing actions.",
    );
    return;
  }

  const redis = new Redis({ url, token });
  const RatelimitConstructor: any =
    (upstashRatelimit as any).Ratelimit ||
    (upstashRatelimit as any).default?.Ratelimit ||
    (upstashRatelimit as any).default;

  if (RatelimitConstructor && typeof RatelimitConstructor.slidingWindow === "function") {
    try {
      const limiter = new RatelimitConstructor({
        redis,
        limiter: RatelimitConstructor.slidingWindow(options.limit, options.window),
        analytics: false,
        prefix: options.prefix,
      });
      const { success } = await limiter.limit(options.key);
      if (!success) {
        throw new Error("Rate limit exceeded");
      }
      return;
    } catch (err: any) {
      if (err.message === "Rate limit exceeded") throw err;
    }
  }

  // Fallback: direct atomic Redis counter with 1-hour expiry
  try {
    const rateLimitKey = `${options.prefix}:${options.key}`;
    const current = await redis.incr(rateLimitKey);
    if (current === 1) {
      await redis.expire(rateLimitKey, 3600);
    }
    if (current > options.limit) {
      throw new Error("Rate limit exceeded");
    }
  } catch (err: any) {
    if (err.message === "Rate limit exceeded") throw err;
    // CAD and AI calls are paid services: do not fail open if the limiter is
    // unavailable, otherwise an outage becomes an unbounded-cost incident.
    console.warn("Rate limit check failed; rejecting the request");
    throw new Error("Rate limit service unavailable");
  }
}
