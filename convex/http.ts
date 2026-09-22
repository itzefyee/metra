import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";

const http = httpRouter();

const MAX_DEVICE_USER_ID_LENGTH = 256;
const MAX_GENERATION_ID_LENGTH = 256;

const CAD_FORMATS = ["step", "stl", "obj", "gltf", "glb"] as const;
const CAD_UNITS = ["mm", "cm", "m", "in", "ft"] as const;
const CAD_CATEGORIES = [
  "bracket",
  "plate",
  "beam",
  "fastener",
  "custom",
] as const;

type JsonObject = Record<string, unknown>;

type CADSpecifications = {
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    thickness?: number;
  };
  material?: {
    grade?: string;
    edgeType?: string;
  };
};

class RequestValidationError extends Error {}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function corsOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(object: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

async function readJsonObject(request: Request): Promise<JsonObject> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new RequestValidationError("Request body must be valid JSON");
  }

  if (!isJsonObject(value)) {
    throw new RequestValidationError("Request body must be a JSON object");
  }

  return value;
}

function readOptionalString(
  body: JsonObject,
  field: string,
): string | undefined {
  if (!hasOwn(body, field)) {
    return undefined;
  }

  const value = body[field];
  if (typeof value !== "string") {
    throw new RequestValidationError(`${field} must be a string`);
  }

  return value;
}

function readDeviceUserId(value: unknown, field = "userId"): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RequestValidationError(`${field} must be a non-empty string`);
  }

  if (value.length > MAX_DEVICE_USER_ID_LENGTH) {
    throw new RequestValidationError(
      `${field} must be at most ${MAX_DEVICE_USER_ID_LENGTH} characters`,
    );
  }

  return value;
}

function readAccessToken(value: unknown, field = "accessToken"): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(value)
  ) {
    throw new RequestValidationError(`${field} is invalid`);
  }
  return value;
}

function readOption(
  value: string,
  allowed: readonly string[],
  field: string,
): string {
  if (!allowed.includes(value)) {
    throw new RequestValidationError(
      `Invalid ${field}. Must be one of: ${allowed.join(", ")}`,
    );
  }

  return value;
}

function rejectUnexpectedFields(
  value: JsonObject,
  allowed: readonly string[],
  field: string,
): void {
  const unexpectedFields = Object.keys(value).filter(
    (key) => !allowed.includes(key),
  );

  if (unexpectedFields.length > 0) {
    throw new RequestValidationError(
      `${field} contains unsupported fields: ${unexpectedFields.join(", ")}`,
    );
  }
}

function parseDimensions(value: unknown): CADSpecifications["dimensions"] {
  if (!isJsonObject(value)) {
    throw new RequestValidationError("specifications.dimensions must be an object");
  }

  const fields = ["length", "width", "height", "thickness"] as const;
  rejectUnexpectedFields(value, fields, "specifications.dimensions");

  const dimensions: NonNullable<CADSpecifications["dimensions"]> = {};
  for (const field of fields) {
    if (!hasOwn(value, field)) {
      continue;
    }

    const dimension = value[field];
    if (typeof dimension !== "number" || !Number.isFinite(dimension)) {
      throw new RequestValidationError(
        `specifications.dimensions.${field} must be a finite number`,
      );
    }

    dimensions[field] = dimension;
  }

  return dimensions;
}

function parseMaterial(value: unknown): CADSpecifications["material"] {
  if (!isJsonObject(value)) {
    throw new RequestValidationError("specifications.material must be an object");
  }

  const fields = ["grade", "edgeType"] as const;
  rejectUnexpectedFields(value, fields, "specifications.material");

  const material: NonNullable<CADSpecifications["material"]> = {};
  for (const field of fields) {
    if (!hasOwn(value, field)) {
      continue;
    }

    const materialValue = value[field];
    if (typeof materialValue !== "string") {
      throw new RequestValidationError(
        `specifications.material.${field} must be a string`,
      );
    }

    material[field] = materialValue;
  }

  return material;
}

function parseSpecifications(value: unknown): CADSpecifications | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isJsonObject(value)) {
    throw new RequestValidationError("specifications must be an object");
  }

  rejectUnexpectedFields(value, ["dimensions", "material"], "specifications");

  const specifications: CADSpecifications = {};
  if (hasOwn(value, "dimensions")) {
    specifications.dimensions = parseDimensions(value.dimensions);
  }
  if (hasOwn(value, "material")) {
    specifications.material = parseMaterial(value.material);
  }

  return specifications;
}

function parseGenerateRequest(body: JsonObject): {
  description: string;
  userId: string;
  category: string;
  format: string;
  units: string;
  specifications?: CADSpecifications;
} {
  const description = readOptionalString(body, "description");
  if (!description || description.trim().length === 0) {
    throw new RequestValidationError(
      "Validation failed: description: Description is required",
    );
  }
  if (description.length > 1000) {
    throw new RequestValidationError(
      "Validation failed: description: Description too long (max 1000 characters)",
    );
  }

  const category = readOption(
    readOptionalString(body, "category") ?? "custom",
    CAD_CATEGORIES,
    "category",
  );
  const format = readOption(
    readOptionalString(body, "format") ?? "step",
    CAD_FORMATS,
    "format",
  );
  const units = readOption(
    readOptionalString(body, "units") ?? "mm",
    CAD_UNITS,
    "units",
  );

  const userIdValue = readOptionalString(body, "userId");
  const userId =
    userIdValue === undefined ? "anonymous" : readDeviceUserId(userIdValue);

  return {
    description,
    userId,
    category,
    format,
    units,
    specifications: parseSpecifications(body.specifications),
  };
}

function getGenerationId(request: Request, routePrefix: string): string {
  const pathname = new URL(request.url).pathname;
  const prefixIndex = pathname.lastIndexOf(routePrefix);
  const encodedId =
    prefixIndex === -1 ? "" : pathname.slice(prefixIndex + routePrefix.length);

  if (!encodedId || encodedId.includes("/")) {
    throw new RequestValidationError("Generation ID is required");
  }

  let id: string;
  try {
    id = decodeURIComponent(encodedId);
  } catch {
    throw new RequestValidationError("Generation ID is invalid");
  }

  if (
    id.length === 0 ||
    id.length > MAX_GENERATION_ID_LENGTH ||
    id.includes("/") ||
    /[\r\n"]/.test(id)
  ) {
    throw new RequestValidationError("Generation ID is invalid");
  }

  return id;
}

async function readDeleteAccessToken(request: Request): Promise<string> {
  const url = new URL(request.url);
  const accessTokenFromQuery = url.searchParams.get("accessToken");
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  let accessTokenFromBody: string | undefined;

  if (contentType.includes("application/json")) {
    const body = await readJsonObject(request);
    if (hasOwn(body, "accessToken")) {
      accessTokenFromBody = readAccessToken(body.accessToken);
    }
  }

  const validatedQueryAccessToken =
    accessTokenFromQuery === null
      ? undefined
      : readAccessToken(accessTokenFromQuery, "accessToken query parameter");

  if (
    validatedQueryAccessToken !== undefined &&
    accessTokenFromBody !== undefined &&
    validatedQueryAccessToken !== accessTokenFromBody
  ) {
    throw new RequestValidationError(
      "accessToken query parameter and request body must match",
    );
  }

  const accessToken = validatedQueryAccessToken ?? accessTokenFromBody;
  if (accessToken === undefined) {
    throw new RequestValidationError("accessToken is required to delete a generation");
  }

  return accessToken;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function invalidGenerateRequest(error: unknown): Response {
  return json(
    {
      error: "Validation failed",
      message: messageFrom(error, "Invalid CAD generation request"),
    },
    400,
  );
}

const generateCAD = httpAction(async (ctx, request) => {
  let payload: ReturnType<typeof parseGenerateRequest>;
  try {
    payload = parseGenerateRequest(await readJsonObject(request));
  } catch (error) {
    return invalidGenerateRequest(error);
  }

  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const rateLimitKey =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "anonymous";
    const result = await ctx.runAction(
      internal.actions.generateCAD.generateFromDescription,
      {
        description: payload.description,
        userId: payload.userId,
        category: payload.category,
        format: payload.format,
        units: payload.units,
        rateLimitKey,
        ...(payload.specifications === undefined
          ? {}
          : { specifications: payload.specifications }),
      },
    );

    return json({
      id: result.generationId,
      status: "completed",
      parameters: {
        format: payload.format,
        units: payload.units,
        category: payload.category,
        generated_at: new Date().toISOString(),
        prompt: payload.description,
      },
      stepFileId: result.stepFileId,
      accessToken: result.accessToken,
    });
  } catch (error) {
    const message = messageFrom(error, "An unexpected error occurred");
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("rate limit")) {
      return json(
        {
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again in a few minutes.",
        },
        429,
      );
    }

    if (
      normalizedMessage.includes("authentication") ||
      normalizedMessage.includes("api key")
    ) {
      return json(
        {
          error: "Authentication failed",
          message: "API authentication failed. Please check configuration.",
        },
        401,
      );
    }

    if (normalizedMessage.includes("timeout")) {
      return json(
        {
          error: "Request timeout",
          message: "The generation took too long. Try simplifying your description.",
        },
        504,
      );
    }

    return json(
      {
        error: "Generation failed",
        message,
      },
      500,
    );
  }
});

const getGenerationStatus = httpAction(async (ctx, request) => {
  let id: string;
  let accessToken: string;
  try {
    id = getGenerationId(request, "/cad/status/");
    accessToken = readAccessToken(
      new URL(request.url).searchParams.get("accessToken"),
      "accessToken query parameter",
    );
  } catch (error) {
    return json({ error: messageFrom(error, "Generation ID is required") }, 400);
  }

  try {
    const generation = await ctx.runQuery(internal.queries.getGenerationByAccessToken, {
      id: id as Id<"cadGenerations">,
      accessToken,
    });

    if (!generation) {
      return json({ error: "Generation not found" }, 404);
    }

    return json({
      id: generation._id,
      status: generation.status,
      created_at: new Date(generation.createdAt).toISOString(),
      completed_at:
        generation.status === "completed"
          ? new Date(generation.createdAt).toISOString()
          : undefined,
      error: generation.status === "failed" ? "Generation failed" : undefined,
    });
  } catch (error) {
    return json(
      {
        error: "Failed to fetch status",
        message: messageFrom(error, "An unexpected error occurred"),
      },
      400,
    );
  }
});

const downloadGeneration = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  let id: string;
  let format: string;
  let accessToken: string;
  try {
    id = getGenerationId(request, "/cad/download/");
    format = readOption(url.searchParams.get("format") ?? "step", CAD_FORMATS, "format");
    accessToken = readAccessToken(
      url.searchParams.get("accessToken"),
      "accessToken query parameter",
    );
  } catch (error) {
    return json({ error: messageFrom(error, "Invalid download request") }, 400);
  }

  try {
    const generation = await ctx.runQuery(internal.queries.getGenerationByAccessToken, {
      id: id as Id<"cadGenerations">,
      accessToken,
    });

    if (!generation) {
      return json({ error: "Generation not found" }, 404);
    }

    if (!generation.stepFileId) {
      return json({ error: "File not available" }, 404);
    }

    const fileUrl = await ctx.runQuery(internal.queries.getFileUrl, {
      storageId: generation.stepFileId,
    });

    if (!fileUrl) {
      return json({ error: "File URL not found" }, 404);
    }

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return json({ error: "Failed to fetch file" }, 500);
    }

    return new Response(fileResponse.body, {
      headers: {
        "Content-Type": `model/${format}`,
        "Content-Disposition": `attachment; filename="model_${id}.${format}"`,
      },
    });
  } catch (error) {
    return json(
      {
        error: "Failed to download file",
        message: messageFrom(error, "An unexpected error occurred"),
      },
      500,
    );
  }
});

const deleteGeneration = httpAction(async (ctx, request) => {
  let id: string;
  let accessToken: string;
  try {
    id = getGenerationId(request, "/cad/generation/");
    accessToken = await readDeleteAccessToken(request);
  } catch (error) {
    return json(
      {
        error: "Invalid delete request",
        message: messageFrom(error, "Invalid delete request"),
      },
      400,
    );
  }

  try {
    await ctx.runMutation(internal.mutations.deleteGeneration, {
      id: id as Id<"cadGenerations">,
      accessToken,
    });
    return json({ success: true });
  } catch (error) {
    const message = messageFrom(error, "Failed to delete generation");
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("generation not found")) {
      return json({ error: "Generation not found" }, 404);
    }
    if (normalizedMessage.includes("not authorized")) {
      return json({ error: "Not authorized to delete this generation" }, 403);
    }

    return json(
      {
        error: "Failed to delete generation",
        message,
      },
      500,
    );
  }
});

const sendChatMessage = httpAction(async (ctx, request) => {
  let body: JsonObject;
  try {
    body = await readJsonObject(request);
  } catch (error) {
    return json(
      { error: messageFrom(error, "Invalid request body") },
      400,
    );
  }

  const message = body.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    return json({ error: "Message is required" }, 400);
  }
  if (message.length > 2000) {
    return json({ error: "Message too long (max 2000 characters)" }, 400);
  }

  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const rateLimitKey =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "anonymous";
    const result = await ctx.runAction(internal.actions.chat.sendMessage, {
      message,
      rateLimitKey,
    });
    return json({ success: true, message: result.message });
  } catch (error) {
    if (messageFrom(error, "").toLowerCase().includes("rate limit")) {
      return json({ error: "Rate limit exceeded" }, 429);
    }
    return json(
      {
        error: "Chat failed",
        message: messageFrom(error, "Failed to send message"),
      },
      500,
    );
  }
});

// The app is mounted under /api by convex.config.ts, so these paths are
// intentionally relative to that mount (for example, /cad/generate becomes
// /api/cad/generate on the static Convex site).
http.route({ path: "/cad/generate", method: "POST", handler: generateCAD });
http.route({ path: "/cad/generate", method: "OPTIONS", handler: httpAction(async () => corsOptions()) });
http.route({
  pathPrefix: "/cad/status/",
  method: "GET",
  handler: getGenerationStatus,
});
http.route({
  pathPrefix: "/cad/status/",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptions()),
});
http.route({
  pathPrefix: "/cad/download/",
  method: "GET",
  handler: downloadGeneration,
});
http.route({
  pathPrefix: "/cad/download/",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptions()),
});
http.route({
  pathPrefix: "/cad/generation/",
  method: "DELETE",
  handler: deleteGeneration,
});
http.route({
  pathPrefix: "/cad/generation/",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptions()),
});
http.route({ path: "/mcp/chat", method: "POST", handler: sendChatMessage });
http.route({ path: "/mcp/chat", method: "OPTIONS", handler: httpAction(async () => corsOptions()) });

export default http;
