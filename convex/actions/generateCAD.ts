"use node";

import { randomBytes } from "crypto";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { enforceRateLimit } from "../upstash";

type CadFormat = "step" | "stl" | "obj" | "gltf" | "glb";
type CadUnits = "mm" | "cm" | "m" | "in" | "ft";
type Dimensions = { length?: number; width?: number; height?: number; thickness?: number };

function validateDescription(description: string): void {
  if (description.trim().length === 0) throw new Error("Description is required");
  if (description.length > 1000) throw new Error("Description too long (max 1000 characters)");
}

function dimension(value: number | undefined, fallback: number): number {
  const candidate = value ?? fallback;
  if (!Number.isFinite(candidate) || candidate <= 0 || candidate > 100_000) {
    throw new Error("CAD dimensions must be finite values between 0 and 100000");
  }
  return candidate;
}

function mimeType(format: CadFormat): string {
  return {
    step: "model/step", stl: "model/stl", obj: "model/obj",
    gltf: "model/gltf+json", glb: "model/gltf-binary",
  }[format];
}

/** Produce a closed triangular-mesh cuboid suitable for Zoo's File API. */
function cuboidObj(dimensions: Dimensions): string {
  const length = dimension(dimensions.length, 100);
  const width = dimension(dimensions.width, 60);
  const height = dimension(dimensions.height ?? dimensions.thickness, 6);
  const vertices = [
    [0, 0, 0], [length, 0, 0], [length, width, 0], [0, width, 0],
    [0, 0, height], [length, 0, height], [length, width, height], [0, width, height],
  ];
  // Outward-facing triangles: the source mesh is watertight before conversion.
  const faces = [
    [1, 3, 2], [1, 4, 3], [5, 6, 7], [5, 7, 8], [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6], [3, 4, 8], [3, 8, 7], [4, 1, 5], [4, 5, 8],
  ];
  return [
    "# Metra CAD generation source mesh",
    ...vertices.map(([x, y, z]) => `v ${x} ${y} ${z}`),
    ...faces.map((face) => `f ${face.join(" ")}`),
    "",
  ].join("\n");
}

/**
 * Convert the watertight source mesh using Zoo's current HTTP File API. This
 * replaces legacy Metalink's removed `/ai/text-to-cad/*` REST endpoint and is
 * compatible with Convex actions, whose supported outbound primitive is fetch.
 */
async function createZooFileExport(args: {
  apiKey: string; dimensions: Dimensions; format: CadFormat;
}): Promise<Blob> {
  const source = cuboidObj(args.dimensions);
  if (args.format === "obj") {
    return new Blob([source], { type: mimeType(args.format) });
  }

  try {
    const { Client, file } = await import("@kittycad/lib");
    const conversion = await file.create_file_conversion({
      client: new Client(args.apiKey),
      src_format: "obj",
      output_format: args.format,
      body: Buffer.from(source).toString("base64"),
    });
    const base64 = conversion.outputs?.[`source.${args.format}`];
    if (conversion.status !== "completed" || typeof base64 !== "string" || base64.length === 0) {
      throw new Error("Zoo File API did not return a completed export");
    }
    return new Blob([Buffer.from(base64, "base64")], { type: mimeType(args.format) });
  } catch {
    // Do not expose upstream service details, request IDs, or configuration.
    throw new Error("Zoo CAD conversion failed");
  }
}

export const generateFromDescription = internalAction({
  args: {
    description: v.string(),
    specifications: v.optional(v.object({
      dimensions: v.optional(v.object({
        length: v.optional(v.number()), width: v.optional(v.number()),
        height: v.optional(v.number()), thickness: v.optional(v.number()),
      })),
      material: v.optional(v.object({ grade: v.optional(v.string()), edgeType: v.optional(v.string()) })),
    })),
    userId: v.optional(v.string()),
    rateLimitKey: v.string(),
    category: v.optional(v.string()),
    format: v.optional(v.string()),
    units: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ generationId: Id<"cadGenerations">; stepFileId: Id<"_storage">; accessToken: string }> => {
    validateDescription(args.description);
    if (args.rateLimitKey.trim().length === 0 || args.rateLimitKey.length > 256) {
      throw new Error("Invalid rate-limit key");
    }

    const specifications = args.specifications ?? {
      dimensions: { length: 100, width: 60, height: 6, thickness: 6 },
      material: { grade: "A36", edgeType: "rolled" },
    };
    const format = (args.format ?? "step") as CadFormat;
    const units = (args.units ?? "mm") as CadUnits;
    if (!["step", "stl", "obj", "gltf", "glb"].includes(format)) throw new Error("Unsupported CAD format");
    if (!["mm", "cm", "m", "in", "ft"].includes(units)) throw new Error("Unsupported CAD units");

    await enforceRateLimit({ key: args.rateLimitKey, prefix: "ratelimit:cad", limit: 10, window: "1 h" });
    const zooApiKey = (process.env.ZOO_DEV_API_KEY ?? process.env.ZOO_API_TOKEN)?.trim();
    if (!zooApiKey) throw new Error("Zoo CAD service is not configured");

    const modelFile = await createZooFileExport({
      apiKey: zooApiKey,
      dimensions: specifications.dimensions ?? {},
      format,
    });
    const stepFileId = await ctx.storage.store(modelFile);
    const accessToken = randomBytes(32).toString("base64url");
    const generationId: Id<"cadGenerations"> = await ctx.runMutation(internal.mutations.createGeneration, {
      description: args.description, specifications, stepFileId, status: "completed", userId: args.userId,
      accessToken, category: args.category, format, units,
    });
    return { generationId, stepFileId, accessToken };
  },
});
