/**
 * MCP Client Library
 * 
 * Helper functions to call MCP server from your Next.js app
 */

const MCP_API_BASE = `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL || ''}/api/mcp`;


/**
 * Chat with MCP assistant
 */
export async function chatViaMCP(message: string) {
  const response = await fetch(`${MCP_API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Chat failed: ${response.status}`);
  }

  return response.json();
}
