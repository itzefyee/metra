"use node";

/**
 * Minimal Azure OpenAI v1 chat-completions client for Convex actions.
 *
 * Azure deployment names are resource-specific, so the deployment is supplied
 * as an environment variable rather than hard-coding a public model name.
 */
export type AzureChatContentPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string; detail?: "auto" | "low" | "high" };
    };

export type AzureChatMessage = {
  role: "system" | "user";
  content: string | AzureChatContentPart[];
};

type AzureChatCompletion = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

function chatCompletionsUrl(endpoint: string): string {
  const normalized = endpoint.trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(normalized)) {
    throw new Error("AZURE_OPENAI_ENDPOINT must be an HTTPS URL");
  }

  return normalized.endsWith("/openai/v1")
    ? `${normalized}/chat/completions`
    : `${normalized}/openai/v1/chat/completions`;
}

export async function createAzureOpenAIClient() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

  if (!endpoint || !apiKey || !deployment) {
    throw new Error(
      "AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT_NAME are required.",
    );
  }

  const url = chatCompletionsUrl(endpoint);
  return {
    model: deployment,
    async createChatCompletion(args: {
      messages: AzureChatMessage[];
      maxTokens: number;
      temperature?: number;
    }): Promise<string> {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          model: deployment,
          messages: args.messages,
          max_tokens: args.maxTokens,
          ...(args.temperature === undefined
            ? {}
            : { temperature: args.temperature }),
        }),
      });

      if (!response.ok) {
        // Do not copy an upstream error body into a Convex/user-visible error:
        // it can contain deployment and policy details.
        throw new Error(`Azure OpenAI request failed (${response.status})`);
      }

      const completion = (await response.json()) as AzureChatCompletion;
      const content = completion.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim().length === 0) {
        throw new Error("Azure OpenAI returned an empty response");
      }
      return content;
    },
  };
}
