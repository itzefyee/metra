import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    emailVerified: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"]),

  profiles: defineTable({
    userId: v.id("users"),
    email: v.string(),
    company: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  cadGenerations: defineTable({
    userId: v.optional(v.string()),
    // A per-generation random capability for the anonymous migration. It is
    // not a user identity and is required for status, download, and deletion.
    accessToken: v.optional(v.string()),
    description: v.string(),
    specifications: v.any(), // Flexible for different spec structures
    stepFileId: v.optional(v.id("_storage")), // Convex file storage
    complianceScore: v.optional(v.number()),
    status: v.string(), // "generating" | "completed" | "failed"
    category: v.optional(v.string()),
    format: v.optional(v.string()),
    units: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  complianceReports: defineTable({
    generationId: v.id("cadGenerations"),
    overallScore: v.number(),
    violations: v.array(v.any()),
    warnings: v.array(v.any()),
    aiAnalysis: v.string(),
    reportPdfId: v.optional(v.id("_storage")),
  }).index("by_generation", ["generationId"]),

  chatSessions: defineTable({
    userId: v.string(),
    messages: v.array(v.object({
      role: v.string(),
      content: v.string(),
      timestamp: v.number(),
    })),
    contextDocuments: v.array(v.string()), // MCP context IDs
  }).index("by_user", ["userId"]),

  drawingAnalyses: defineTable({
    // Existing authenticated analyses retain their userId. Anonymous browser
    // sessions are scoped with an opaque clientId until real Convex auth is
    // configured; it must not be treated as an authorization credential.
    userId: v.optional(v.id("users")),
    clientId: v.optional(v.string()),
    fileName: v.string(),
    storageId: v.optional(v.id("_storage")),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    extractedSpecs: v.optional(v.any()),
    recommendedProducts: v.optional(v.array(v.any())),
    confidence: v.optional(v.number()),
    reasoning: v.optional(v.string()),
    aiResponse: v.optional(v.any()),
    analyzedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_client_id", ["clientId"])
    .index("by_analyzed_at", ["analyzedAt"]),

  // Component Taxonomy - canonical component types and aliases
  componentTaxonomy: defineTable({
    canonicalName: v.string(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    keywords: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_category", ["category"])
    .index("by_canonical_name", ["canonicalName"]),

  // Material Synonyms - maps freeform text to normalized families
  materialSynonyms: defineTable({
    family: v.string(),
    synonyms: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_family", ["family"]),

  // Products - main product catalog
  products: defineTable({
    id: v.string(), // Keep original ID from Supabase
    name: v.string(),
    category: v.string(), // 'robotic', 'structural', 'fasteners', 'custom'
    material: v.optional(v.union(v.string(), v.null())),
    materialFamily: v.optional(v.union(v.string(), v.null())),
    componentTypeId: v.optional(v.union(v.id("componentTaxonomy"), v.null())),
    specifications: v.any(), // JSON object
    price: v.number(),
    images: v.array(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    technicalDetails: v.optional(v.union(v.string(), v.null())),
    compatibleWith: v.array(v.string()),
    inStock: v.boolean(),
    leadTime: v.optional(v.union(v.string(), v.null())),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_product_id", ["id"])
    .index("by_category", ["category"])
    .index("by_material_family", ["materialFamily"])
    .index("by_component_type", ["componentTypeId"])
    .index("by_in_stock", ["inStock"]),

  // Product Specs - structured specifications per product
  productSpecs: defineTable({
    productId: v.string(), // Reference to products.id (not a foreign key in Convex)
    widthMm: v.optional(v.union(v.number(), v.null())),
    heightMm: v.optional(v.union(v.number(), v.null())),
    depthMm: v.optional(v.union(v.number(), v.null())),
    diameterMm: v.optional(v.union(v.number(), v.null())),
    thicknessMm: v.optional(v.union(v.number(), v.null())),
    lengthMm: v.optional(v.union(v.number(), v.null())),
    loadMinKn: v.optional(v.union(v.number(), v.null())),
    loadMaxKn: v.optional(v.union(v.number(), v.null())),
    weightKg: v.optional(v.union(v.number(), v.null())),
    metadata: v.optional(v.any()), // JSON object
    updatedAt: v.string(),
  })
    .index("by_product_id", ["productId"])
    .index("by_dimensions", ["widthMm", "heightMm", "depthMm", "diameterMm"])
    .index("by_load", ["loadMinKn", "loadMaxKn"]),

  // Product Embeddings - vector embeddings for similarity search
  productEmbeddings: defineTable({
    productId: v.string(), // Reference to products.id
    embedding: v.optional(v.array(v.number())), // Vector embedding array
    source: v.optional(v.string()),
    updatedAt: v.string(),
  })
    .index("by_product_id", ["productId"])
    .index("by_source", ["source"]),
});
