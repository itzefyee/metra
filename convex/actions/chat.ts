"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { MCP_STANDARDS } from "../mcp/config";
import { createAzureOpenAIClient } from "../azureOpenAI";
import { enforceRateLimit } from "../upstash";

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

    await enforceRateLimit({
      key: args.rateLimitKey,
      prefix: "ratelimit:chat",
      limit: 50,
      window: "1 h",
    });

    const azureOpenAI = await createAzureOpenAIClient();
    const system = `You are Metra Assistant, an expert assistant for the Metra CAD Generator.

You have access to these steel manufacturing standards:
${MCP_STANDARDS.map((uri) => `- ${uri}`).join("\n")}

Help users generate CAD drawings, explain applicable manufacturing standards,
troubleshoot problems, and suggest design improvements. Be concise, helpful,
and technically accurate.`;

    return {
      message: await azureOpenAI.createChatCompletion({
        maxTokens: 2048,
        messages: [
          { role: "system", content: system },
          { role: "user", content: args.message.trim() },
        ],
      }),
    };
  },
});
