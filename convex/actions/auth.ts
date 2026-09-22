"use node";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import crypto from "crypto";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 128;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SafeUser = {
  _id: Id<"users">;
  email: string;
  emailVerified?: boolean;
  createdAt: number;
  updatedAt: number;
};

type SafeProfile = {
  _id: Id<"profiles">;
  userId: Id<"users">;
  email: string;
  company?: string;
  phone?: string;
  role?: string;
  metadata?: unknown;
  createdAt: number;
  updatedAt: number;
};

type VerifySessionResult =
  | { valid: false; user?: undefined; profile?: undefined }
  | { valid: true; user: SafeUser; profile: SafeProfile | null };

type UpdateProfileResult = {
  error: string | null;
  profile?: SafeProfile | null;
};

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, expectedHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex || !/^[a-f0-9]+$/i.test(expectedHex)) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function validToken(token: string): boolean {
  return token.length > 0 && token.length <= MAX_TOKEN_LENGTH;
}

function accountUser(user: {
  _id: Id<"users">;
  email: string;
  emailVerified?: boolean;
  createdAt: number;
  updatedAt: number;
}): SafeUser {
  return {
    _id: user._id,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const signUp = action({
  args: {
    email: v.string(),
    password: v.string(),
    metadata: v.optional(v.object({
      company: v.optional(v.string()),
      phone: v.optional(v.string()),
      role: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args): Promise<{ error: string | null; userId?: string; token?: string }> => {
    try {
      // Validate email format
      const email = args.email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(email) || email.length > 254) {
        return { error: "Invalid email format" };
      }

      // Validate password strength
      if (args.password.length < 8 || args.password.length > 200) {
        return { error: "Password must be between 8 and 200 characters" };
      }

      // Check if user already exists
      const existingUser = await ctx.runQuery(internal.queries.getUserByEmail, {
        email,
      });

      if (existingUser) {
        return { error: "User already exists with this email" };
      }

      // Hash password
      const passwordHash = hashPassword(args.password);

      // Create user
      const userId = await ctx.runMutation(internal.mutations.createUser, {
        email,
        passwordHash,
      });

      // Create profile
      await ctx.runMutation(internal.mutations.createProfile, {
        userId,
        email,
        company: args.metadata?.company,
        phone: args.metadata?.phone,
        role: args.metadata?.role,
      });

      // Create session
      const token = generateToken();
      const expiresAt = Date.now() + SESSION_DURATION_MS;

      await ctx.runMutation(internal.mutations.createSession, {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt,
      });

      return { error: null, userId, token };
    } catch (error) {
      console.error("Sign up error:", error);
      return { error: error instanceof Error ? error.message : "Sign up failed" };
    }
  },
});

export const signIn = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ error: string | null; userId?: string; token?: string }> => {
    try {
      // Get user by email
      const email = args.email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(email) || args.password.length > 200) {
        return { error: "Invalid email or password" };
      }

      const user = await ctx.runQuery(internal.queries.getUserByEmail, {
        email,
      });

      if (!user) {
        return { error: "Invalid email or password" };
      }

      // Verify password
      if (!verifyPassword(args.password, user.passwordHash)) {
        return { error: "Invalid email or password" };
      }

      // Create new session
      const token = generateToken();
      const expiresAt = Date.now() + SESSION_DURATION_MS;

      await ctx.runMutation(internal.mutations.createSession, {
        userId: user._id,
        tokenHash: hashSessionToken(token),
        expiresAt,
      });

      return { error: null, userId: user._id, token };
    } catch (error) {
      console.error("Sign in error:", error);
      return { error: error instanceof Error ? error.message : "Sign in failed" };
    }
  },
});

export const signOut = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{ error: string | null }> => {
    try {
      if (validToken(args.token)) {
        await ctx.runMutation(internal.mutations.deleteSession, {
          tokenHash: hashSessionToken(args.token),
        });
      }

      return { error: null };
    } catch (error) {
      console.error("Sign out error:", error);
      return { error: error instanceof Error ? error.message : "Sign out failed" };
    }
  },
});

export const verifySession = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<VerifySessionResult> => {
    try {
      if (!validToken(args.token)) {
        return { valid: false };
      }

      const tokenHash = hashSessionToken(args.token);
      const session = await ctx.runQuery(internal.queries.getSessionByTokenHash, {
        tokenHash,
      });

      if (!session) {
        return { valid: false };
      }

      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        // Delete expired session
        await ctx.runMutation(internal.mutations.deleteSession, {
          tokenHash,
        });
        return { valid: false };
      }

      const [user, profile] = await Promise.all([
        ctx.runQuery(internal.queries.getUserById, { userId: session.userId }),
        ctx.runQuery(internal.queries.getProfileByUserId, { userId: session.userId }),
      ]);
      if (!user) {
        return { valid: false };
      }

      return { valid: true, user: accountUser(user), profile };
    } catch (error) {
      console.error("Verify session error:", error);
      return { valid: false };
    }
  },
});

export const updateMyProfile = action({
  args: {
    token: v.string(),
    company: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<UpdateProfileResult> => {
    if (!validToken(args.token)) {
      return { error: "Invalid session" };
    }

    const session = await ctx.runQuery(internal.queries.getSessionByTokenHash, {
      tokenHash: hashSessionToken(args.token),
    });
    if (!session || session.expiresAt < Date.now()) {
      return { error: "Invalid session" };
    }

    const company = args.company?.trim();
    const phone = args.phone?.trim();
    if ((company && company.length > 120) || (phone && phone.length > 40)) {
      return { error: "Profile fields exceed the allowed length" };
    }

    await ctx.runMutation(internal.mutations.updateProfile, {
      userId: session.userId,
      company: company || undefined,
      phone: phone || undefined,
    });
    const profile = await ctx.runQuery(internal.queries.getProfileByUserId, {
      userId: session.userId,
    });
    return { error: null, profile };
  },
});





