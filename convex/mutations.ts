import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

const MAX_COMPLIANCE_REPORTS_PER_GENERATION = 100;
const MAX_CHAT_MESSAGES_PER_SESSION = 40;

// Auth Mutations
export const createUser = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      email: args.email,
      passwordHash: args.passwordHash,
      emailVerified: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return userId;
  },
});

export const createProfile = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    company: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profileId = await ctx.db.insert("profiles", {
      userId: args.userId,
      email: args.email,
      company: args.company,
      phone: args.phone,
      role: args.role,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return profileId;
  },
});

export const updateProfile = internalMutation({
  args: {
    userId: v.id("users"),
    company: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    await ctx.db.patch(profile._id, {
      company: args.company,
      phone: args.phone,
      role: args.role,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});

export const createSession = internalMutation({
  args: {
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("sessions", {
      userId: args.userId,
      token: args.tokenHash,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
    return sessionId;
  },
});

export const deleteSession = internalMutation({
  args: {
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.tokenHash))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

// CAD Generation Mutations
export const createGeneration = internalMutation({
  args: {
    description: v.string(),
    specifications: v.any(),
    stepFileId: v.optional(v.id("_storage")),
    status: v.string(),
    userId: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    category: v.optional(v.string()),
    format: v.optional(v.string()),
    units: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const generationId = await ctx.db.insert("cadGenerations", {
      description: args.description,
      specifications: args.specifications,
      stepFileId: args.stepFileId,
      status: args.status,
      userId: args.userId,
      accessToken: args.accessToken,
      category: args.category,
      format: args.format,
      units: args.units,
      createdAt: Date.now(),
    });
    return generationId;
  },
});

/**
 * Deletes one CAD generation only when its random capability matches. This is
 * intentionally distinct from browser-local IDs, which are not authorization.
 */
export const deleteGeneration = internalMutation({
  args: {
    id: v.id("cadGenerations"),
    accessToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.accessToken.trim().length === 0) {
      throw new Error("accessToken must not be empty");
    }

    const generation = await ctx.db.get(args.id);
    if (!generation) {
      throw new Error("Generation not found");
    }

    if (!generation.accessToken || generation.accessToken !== args.accessToken) {
      throw new Error("Not authorized to delete this generation");
    }

    // A generation normally has one report, but keep the cleanup bounded so a
    // malformed data set cannot make this mutation exceed transaction limits.
    const reports = await ctx.db
      .query("complianceReports")
      .withIndex("by_generation", (q) => q.eq("generationId", args.id))
      .take(MAX_COMPLIANCE_REPORTS_PER_GENERATION + 1);

    if (reports.length > MAX_COMPLIANCE_REPORTS_PER_GENERATION) {
      throw new Error("Generation has too many compliance reports to delete");
    }

    for (const report of reports) {
      if (report.reportPdfId) {
        await ctx.storage.delete(report.reportPdfId);
      }
      await ctx.db.delete(report._id);
    }

    if (generation.stepFileId) {
      await ctx.storage.delete(generation.stepFileId);
    }

    await ctx.db.delete(generation._id);
    return null;
  },
});

export const appendChatMessage = internalMutation({
  args: {
    userId: v.string(),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        timestamp: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existingSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existingSession) {
      await ctx.db.patch(existingSession._id, {
        messages: [...existingSession.messages, ...args.messages].slice(
          -MAX_CHAT_MESSAGES_PER_SESSION,
        ),
      });
      return existingSession._id;
    } else {
      const sessionId = await ctx.db.insert("chatSessions", {
        userId: args.userId,
        messages: args.messages.slice(-MAX_CHAT_MESSAGES_PER_SESSION),
        contextDocuments: [],
      });
      return sessionId;
    }
  },
});

// Drawing Analyses Mutations
export const createDrawingAnalysis = internalMutation({
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

// Note: File storage is handled via actions, not mutations
// See convex/files.ts for the upload action
