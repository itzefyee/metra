import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Product Specs Queries & Mutations
 */

// Query: List all product specs
export const list = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("productSpecs").collect();
  },
});

/**
 * Product Specs Mutations
 * Handles batch creation of product specification entries
 */

export const batchCreate = internalMutation({
  args: {
    specs: v.array(
      v.object({
        productId: v.string(),
        widthMm: v.optional(v.union(v.number(), v.null())),
        heightMm: v.optional(v.union(v.number(), v.null())),
        depthMm: v.optional(v.union(v.number(), v.null())),
        diameterMm: v.optional(v.union(v.number(), v.null())),
        thicknessMm: v.optional(v.union(v.number(), v.null())),
        lengthMm: v.optional(v.union(v.number(), v.null())),
        loadMinKn: v.optional(v.union(v.number(), v.null())),
        loadMaxKn: v.optional(v.union(v.number(), v.null())),
        weightKg: v.optional(v.union(v.number(), v.null())),
        metadata: v.optional(v.any()),
        updatedAt: v.string(),
        // Allow but ignore id field from Supabase export
        id: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = [];
    for (const spec of args.specs) {
      // Strip the id field if present and convert null to undefined
      const { id, ...specData } = spec;
      
      // Build spec object with only provided fields (optional fields can be omitted)
      const cleanedSpec: any = {
        productId: specData.productId,
        updatedAt: specData.updatedAt,
      };
      
      // Only include optional fields if they are provided (not undefined)
      if (specData.widthMm !== undefined) cleanedSpec.widthMm = specData.widthMm ?? null;
      if (specData.heightMm !== undefined) cleanedSpec.heightMm = specData.heightMm ?? null;
      if (specData.depthMm !== undefined) cleanedSpec.depthMm = specData.depthMm ?? null;
      if (specData.diameterMm !== undefined) cleanedSpec.diameterMm = specData.diameterMm ?? null;
      if (specData.thicknessMm !== undefined) cleanedSpec.thicknessMm = specData.thicknessMm ?? null;
      if (specData.lengthMm !== undefined) cleanedSpec.lengthMm = specData.lengthMm ?? null;
      if (specData.loadMinKn !== undefined) cleanedSpec.loadMinKn = specData.loadMinKn ?? null;
      if (specData.loadMaxKn !== undefined) cleanedSpec.loadMaxKn = specData.loadMaxKn ?? null;
      if (specData.weightKg !== undefined) cleanedSpec.weightKg = specData.weightKg ?? null;
      if (specData.metadata !== undefined) cleanedSpec.metadata = specData.metadata;
      
      // Check if spec already exists by productId
      const existing = await ctx.db
        .query("productSpecs")
        .withIndex("by_product_id", (q) => q.eq("productId", spec.productId))
        .first();

      if (existing) {
        // Update existing spec
        await ctx.db.patch(existing._id, cleanedSpec);
        results.push(existing._id);
      } else {
        // Create new spec
        const newId = await ctx.db.insert("productSpecs", cleanedSpec);
        results.push(newId);
      }
    }
    return results;
  },
});
