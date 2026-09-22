"use node";

/**
 * Creates an Anthropic-compatible client for server-side AI work.
 *
 * AI Gateway is preferred so Metra's Convex actions use the gateway configured
 * with `npx vercel ai-gateway setup`. A direct Anthropic key remains a
 * temporary migration fallback for existing deployments.
 */
export async function createAnthropicClient() {
  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;
  const apiKey = gatewayApiKey ?? process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "AI_GATEWAY_API_KEY is required (ANTHROPIC_API_KEY is supported temporarily for migration).",
    );
  }

  const { Anthropic } = await import("@anthropic-ai/sdk");
  return {
    client: new Anthropic({
      apiKey,
      ...(gatewayApiKey ? { baseURL: "https://ai-gateway.vercel.sh" } : {}),
    }),
    model: gatewayApiKey
      ? "anthropic/claude-sonnet-4.6"
      : "claude-sonnet-4-5-20250929",
  };
}
