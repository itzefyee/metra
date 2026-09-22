"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { MCP_STANDARDS } from "../mcp/config";
import { createAnthropicClient } from "../aiGateway";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_RATE_LIMIT_KEY_LENGTH = 256;

/**
 * Sends one chat turn. Conversation history remains in the browser during the
 * anonymous migration, avoiding server-side cross-user history keyed only by a
 * browser-generated identifier.
 */
export const sendMessage = internalAction({
  args: {
    message: v.string(),
    rateLimitKey: v.string(),
  },
  handler: async (_ctx, args): Promise<{ message: string }> => {
    if (
      args.message.trim().length === 0 ||
      args.message.length > MAX_MESSAGE_LENGTH
    ) {
      throw new Error(`message must be between 1 and ${MAX_MESSAGE_LENGTH} characters`);
    }
    if (
      args.rateLimitKey.trim().length === 0 ||
      args.rateLimitKey.length > MAX_RATE_LIMIT_KEY_LENGTH
    ) {
      throw new Error("Invalid rate-limit key");
    }

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (redisUrl && redisToken) {
      try {
        const { Redis } = await import("@upstash/redis");
        const { Ratelimit } = await import("@upstash/ratelimit");
        const redis = new Redis({ url: redisUrl, token: redisToken });
        const limiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(50, "1 h"),
          analytics: true,
          prefix: "ratelimit:chat",
        });
        const { success } = await limiter.limit(args.rateLimitKey);
        if (!success) {
          throw new Error("Rate limit exceeded");
        }
      } catch (error) {
        if (error instanceof Error && error.message === "Rate limit exceeded") {
          throw error;
        }
        console.warn("Chat rate limiting is unavailable", error);
      }
    }

    const { client: anthropic, model } = await createAnthropicClient();
    const system = `You are Metra Assistant, an expert assistant for the Metra CAD Generator.

You have access to these steel manufacturing standards:
${MCP_STANDARDS.map((uri) => `- ${uri}`).join("\n")}

Help users generate CAD drawings, explain applicable manufacturing standards,
troubleshoot problems, and suggest design improvements. Be concise, helpful,
and technically accurate.`;

    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: args.message.trim() }],
    });
    const firstContent = response.content[0];
    return {
      message: firstContent.type === "text" ? firstContent.text : "",
    };
  },
});
