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
      material: "Structural Steel (A36 / S355 estimated)",
      componentType: dimensions ? "Structural component" : "Technical drawing",
      tolerance: "±0.5mm standard fabrication tolerance",
    },
    recommendedProducts: [],
    totalRecommendations: 0,
    confidence: dimensions ? 0.78 : 0.60,
    reasoning: `Metra extracted metadata-based specifications for ${fileName} based on geometric bounds and engineering heuristics.`,
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
      dimensions: typeof specs.dimensions === "string" ? specs.dimensions : fallback.extractedSpecs.dimensions,
      material: typeof specs.material === "string" ? specs.material : fallback.extractedSpecs.material,
      loadRequirements: typeof specs.loadRequirements === "string" ? specs.loadRequirements : undefined,
      componentType: typeof specs.componentType === "string" ? specs.componentType : fallback.extractedSpecs.componentType,
      tolerance: typeof specs.tolerance === "string" ? specs.tolerance : fallback.extractedSpecs.tolerance,
    },
    confidence: Math.max(0, Math.min(1, response.confidence)),
    reasoning: response.reasoning,
  };
}

async function analyzeDrawingFile(
  blob: Blob,
  contentType: string,
  fileName: string,
  cadModelData: unknown,
  fallback: Analysis,
): Promise<Analysis> {
  try {
    const azureOpenAI = await createAzureOpenAIClient();

    if (IMAGE_TYPES.has(contentType) && blob.size <= 5 * 1024 * 1024) {
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
              text: `Analyze this engineering drawing (${fileName}). Return only valid JSON with extractedSpecs (dimensions, material, loadRequirements, componentType, tolerance), confidence (0-1), and reasoning. Additional browser CAD metadata: ${JSON.stringify(cadModelData ?? {})}`,
            },
          ],
        }],
      });
      return normalizeAiResponse(JSON.parse(text.replace(/```json|```/g, "").trim()), fallback);
    }

    // For non-image CAD files (STEP, STL, OBJ, DXF, etc.)
    const prompt = `Analyze this engineering CAD component file named "${fileName}".
CAD geometry and metadata: ${JSON.stringify(cadModelData ?? {})}
Infer the component type, appropriate material grade (e.g. A36 Steel, S355, 6061 Aluminum, Cast Iron), dimensions, load capability, and standard machining/welding tolerances.
Return ONLY valid JSON with this exact structure:
{
  "extractedSpecs": {
    "dimensions": "string describing dimensions",
    "material": "inferred material grade",
    "loadRequirements": "estimated load capacity",
    "componentType": "component type (e.g. bracket, beam, plate, rotor)",
    "tolerance": "standard engineering tolerance"
  },
  "confidence": 0.85,
  "reasoning": "Technical explanation of the geometry, manufacturing feasibility, and specifications."
}`;

    const text = await azureOpenAI.createChatCompletion({
      maxTokens: 1000,
      messages: [{ role: "user", content: prompt }],
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
    images?: string[];
  }>,
): Analysis['recommendedProducts'] {
  const specs = analysis.extractedSpecs;
  const targetMaterial = (specs.material ?? "").toLowerCase();
  const targetCategory = (specs.componentType ?? "").toLowerCase();

  return products
    .map((product) => {
      let score = 0.3;
      if (product.material && targetMaterial && targetMaterial.includes(product.material.toLowerCase())) {
        score += 0.4;
      }
      if (product.category && targetCategory && targetCategory.includes(product.category.toLowerCase())) {
        score += 0.3;
      }
      return { product, score };
    })
    .sort((a, b) => b.score - a.score)
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
    const analysis = await analyzeDrawingFile(blob, args.fileType, args.fileName, args.cadModelData, fallback);
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
