import { mutation } from "./_generated/server";

/**
 * Create a short-lived Convex Storage upload URL for a browser-selected file.
 *
 * Files must be sent directly to Storage rather than as a function argument:
 * Convex function arguments are intentionally much smaller than the 10 MB CAD
 * drawings the UI accepts.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});
