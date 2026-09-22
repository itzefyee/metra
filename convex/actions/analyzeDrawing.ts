"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { createAzureOpenAIClient } from "../azureOpenAI";
import { enforceRateLimit } from "../upstash";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "step",
  "stp",
  "stl",
  "obj",
  "dxf",
  "gltf",
  "glb",
]);

type ExtractedSpecs = {
  dimensions?: string;
  material?: string;
  loadRequirements?: string;
  componentType?: string;
  tolerance?: string;
};

type Analysis = {
  extractedSpecs: ExtractedSpecs;
  recommendedProducts: Array<{
    id: string;
    name: string;
    category: string;
    material?: string | null;
    price?: number;
    images?: string[];
  }>;
  totalRecommendations: number;
  confidence: number;
  reasoning: string;
  analysisId: string;
  alternativeSuggestions?: {
    message: string;
    suggestedCategories: string[];
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readableExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function fallbackAnalysis(fileName: string, cadModelData: unknown, analysisId: string): Analysis {
  const cadData = asRecord(cadModelData);
  const boundingBox = asRecord(cadData?.boundingBox);
  const length = typeof boundingBox?.length === "number" ? boundingBox.length : null;
  const width = typeof boundingBox?.width === "number" ? boundingBox.width : null;
  const height = typeof boundingBox?.height === "number" ? boundingBox.height : null;

  const dimensions =
    length !== null && width !== null && height !== null
      ? `${(length * 25.4).toFixed(1)}mm × ${(width * 25.4).toFixed(1)}mm × ${(height * 25.4).toFixed(1)}mm`
      : undefined;

  return {
    extractedSpecs: {
      dimensions,
      material: "Material analysis pending",
      componentType: dimensions ? "Structural component" : "Technical drawing",
      tolerance: "Review the source drawing for specified tolerances",
    },
    recommendedProducts: [],
    totalRecommendations: 0,
    confidence: dimensions ? 0.72 : 0.45,
    reasoning: `Metra created a metadata-based analysis for ${fileName}. Configure Azure OpenAI in Convex to enable image analysis.`,
    analysisId,
    alternativeSuggestions: {
      message: "No exact catalog match was found. Consider custom fabrication or a related structural component.",
      suggestedCategories: ["custom", "structural"],
    },
  };
}

function normalizeAiResponse(value: unknown, fallback: Analysis): Analysis {
  const response = asRecord(value);
  const specs = asRecord(response?.extractedSpecs);
  if (!response || !specs || typeof response.confidence !== "number" || typeof response.reasoning !== "string") {
    return fallback;
  }

  return {
    ...fallback,
    extractedSpecs: {
      dimensions: typeof specs.dimensions === "string" ? specs.dimensions : undefined,
      material: typeof specs.material === "string" ? specs.material : undefined,
      loadRequirements: typeof specs.loadRequirements === "string" ? specs.loadRequirements : undefined,
      componentType: typeof specs.componentType === "string" ? specs.componentType : undefined,
      tolerance: typeof specs.tolerance === "string" ? specs.tolerance : undefined,
    },
    confidence: Math.max(0, Math.min(1, response.confidence)),
    reasoning: response.reasoning,
  };
}

async function analyzeImage(
  blob: Blob,
  contentType: string,
  cadModelData: unknown,
  fallback: Analysis,
): Promise<Analysis> {
  if (!IMAGE_TYPES.has(contentType) || blob.size > 5 * 1024 * 1024) {
    return fallback;
  }

  try {
    const azureOpenAI = await createAzureOpenAIClient();
    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const text = await azureOpenAI.createChatCompletion({
      maxTokens: 1200,
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${contentType};base64,${base64}`, detail: "high" },
          },
          {
            type: "text",
            text: `Analyze this engineering drawing. Return only JSON with extractedSpecs (dimensions, material, loadRequirements, componentType, tolerance), confidence (0-1), and reasoning. Additional browser CAD metadata: ${JSON.stringify(cadModelData ?? {})}`,
          },
        ],
      }],
    });
    return normalizeAiResponse(JSON.parse(text.replace(/```json|```/g, "").trim()), fallback);
  } catch (error) {
    console.warn("Drawing analysis fell back to metadata", error);
    return fallback;
  }
}

function scoreProducts(
  analysis: Analysis,
  products: Array<{
    _id: string;
    name: string;
    category: string;
    material?: string | null;
    price: number;
    images: string[];
    description?: string | null;
    inStock: boolean;
  }>,
) {
  const searchTerms = [
    analysis.extractedSpecs.componentType,
    analysis.extractedSpecs.material,
    analysis.extractedSpecs.dimensions,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);

  return products
    .map((product) => {
      const haystack = `${product.name} ${product.category} ${product.material ?? ""} ${product.description ?? ""}`.toLowerCase();
      const score = searchTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0) + (product.inStock ? 0.25 : 0);
      return { product, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ product }) => ({
      id: product._id,
      name: product.name,
      category: product.category,
      material: product.material,
      price: product.price,
      images: product.images,
    }));
}

export const analyzeUploadedDrawing = action({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    clientId: v.optional(v.string()),
    rateLimitKey: v.string(),
    cadModelData: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<Analysis> => {
    if (args.rateLimitKey.trim().length === 0 || args.rateLimitKey.length > 256) {
      throw new Error("Invalid rate-limit key");
    }
    await enforceRateLimit({
      key: args.rateLimitKey,
      prefix: "ratelimit:drawing-analysis",
      limit: 20,
      window: "1 h",
    });

    const extension = readableExtension(args.fileName);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error("Unsupported drawing type. Upload PDF, PNG, JPG, STEP, STL, OBJ, DXF, GLTF, or GLB.");
    }

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new Error("The uploaded drawing is no longer available.");
    }
    if (blob.size > MAX_FILE_SIZE) {
      throw new Error("File size exceeds the 10MB limit.");
    }

    const analysisId = `analysis_${args.storageId}`;
    const fallback = fallbackAnalysis(args.fileName, args.cadModelData, analysisId);
    const analysis = await analyzeImage(blob, args.fileType, args.cadModelData, fallback);
    const products = await ctx.runQuery(internal.queries.searchProducts, {});
    analysis.recommendedProducts = scoreProducts(analysis, products);
    analysis.totalRecommendations = analysis.recommendedProducts.length;

    await ctx.runMutation(internal.drawingAnalyses.saveForClient, {
      clientId: args.clientId,
      fileName: args.fileName,
      storageId: args.storageId,
      fileType: args.fileType || blob.type || "application/octet-stream",
      fileSize: blob.size,
      extractedSpecs: analysis.extractedSpecs,
      recommendedProducts: analysis.recommendedProducts,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      aiResponse: analysis,
    });

    return analysis;
  },
});
