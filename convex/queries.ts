import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_GENERATION_LIST_LIMIT = 20;
const MAX_GENERATION_LIST_LIMIT = 100;

// Auth Queries
export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return user;
  },
});

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getProfileByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return profile;
  },
});

export const getSessionByTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.tokenHash))
      .first();
    return session;
  },
});

// CAD Generation Queries
export const getGeneration = internalQuery({
  args: { id: v.id("cadGenerations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getGenerationByAccessToken = internalQuery({
  args: {
    id: v.id("cadGenerations"),
    accessToken: v.string(),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.id);
    if (!generation || !generation.accessToken || generation.accessToken !== args.accessToken) {
      return null;
    }
    return generation;
  },
});

export const getComplianceReport = internalQuery({
  args: { generationId: v.id("cadGenerations") },
  handler: async (ctx, args) => {
    const report = await ctx.db
      .query("complianceReports")
      .withIndex("by_generation", (q) => q.eq("generationId", args.generationId))
      .first();
    return report;
  },
});

export const getChatSession = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return session;
  },
});

export const listGenerations = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("cadGenerations")
      .order("desc")
      .take(limit);
  },
});

/**
 * Returns a bounded, user-scoped generation history for the HTTP API.
 *
 * Device user IDs are not authentication, so this is intentionally internal:
 * callers must go through the HTTP handler that validates the request shape.
 */
export const listGenerationsByUser = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.userId.trim().length === 0) {
      throw new Error("userId must not be empty");
    }

    const limit = args.limit ?? DEFAULT_GENERATION_LIST_LIMIT;
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_GENERATION_LIST_LIMIT
    ) {
      throw new Error(
        `limit must be an integer between 1 and ${MAX_GENERATION_LIST_LIMIT}`,
      );
    }

    return await ctx.db
      .query("cadGenerations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

export const getFileUrl = internalQuery({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Drawing Analyses Queries
export const getDrawingAnalysis = internalQuery({
  args: { id: v.id("drawingAnalyses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getDrawingAnalysesByUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("drawingAnalyses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Products Queries
export const getProduct = internalQuery({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const searchProducts = internalQuery({
  args: {
    category: v.optional(v.string()),
    materialFamily: v.optional(v.string()),
    componentType: v.optional(v.id("componentTaxonomy")),
  },
  handler: async (ctx, args) => {
    // Use conditional logic to build the correct query
    if (args.category) {
      return await ctx.db
        .query("products")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .take(100);
    } else if (args.materialFamily) {
      return await ctx.db
        .query("products")
        .withIndex("by_material_family", (q) => q.eq("materialFamily", args.materialFamily!))
        .take(100);
    } else if (args.componentType) {
      return await ctx.db
        .query("products")
        .withIndex("by_component_type", (q) => q.eq("componentTypeId", args.componentType!))
        .take(100);
    }
    
    // Default: return all products (limited)
    return await ctx.db
      .query("products")
      .take(100);
  },
});
