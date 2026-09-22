import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    fileName: v.string(),
    storageId: v.optional(v.id("_storage")),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    extractedSpecs: v.optional(v.any()),
    recommendedProducts: v.optional(v.array(v.any())),
    confidence: v.optional(v.number()),
    reasoning: v.optional(v.string()),
    claudeResponse: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("drawingAnalyses", {
      userId: args.userId,
      fileName: args.fileName,
      storageId: args.storageId,
      fileType: args.fileType,
      fileSize: args.fileSize,
      extractedSpecs: args.extractedSpecs,
      recommendedProducts: args.recommendedProducts,
      confidence: args.confidence,
      reasoning: args.reasoning,
      claudeResponse: args.claudeResponse,
      analyzedAt: Date.now(),
    });
  },
});

export const getByUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("drawingAnalyses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

/** Persist an analysis created from an unauthenticated browser device.
 *
 * This is deliberately internal: callers receive an opaque clientId only for
 * local grouping, never as proof of a user's identity or permission.
 */
export const saveForClient = internalMutation({
  args: {
    clientId: v.optional(v.string()),
    fileName: v.string(),
    storageId: v.id("_storage"),
    fileType: v.string(),
    fileSize: v.number(),
    extractedSpecs: v.any(),
    recommendedProducts: v.array(v.any()),
    confidence: v.number(),
    reasoning: v.string(),
    claudeResponse: v.any(),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("drawingAnalyses", {
      clientId: args.clientId,
      fileName: args.fileName,
      storageId: args.storageId,
      fileType: args.fileType,
      fileSize: args.fileSize,
      extractedSpecs: args.extractedSpecs,
      recommendedProducts: args.recommendedProducts,
      confidence: args.confidence,
      reasoning: args.reasoning,
      claudeResponse: args.claudeResponse,
      analyzedAt: Date.now(),
    }),
});





