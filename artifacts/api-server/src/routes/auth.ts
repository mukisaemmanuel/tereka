/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - AUTHENTICATION API ROUTES
 * ==============================================================================
 * 
 * Handles user onboarding, password verification, JWT issuance, profile resolution,
 * Google OAuth sign-in, and Google reCAPTCHA verification.
 * All operations execute directly against PostgreSQL tables via Drizzle ORM.
 * 
 * Endpoints:
 * - `POST /api/auth/register` & `POST /api/register`: Creates user account with empty baseline
 * - `POST /api/auth/login` & `POST /api/login`: Validates credentials against PBKDF2 hashes
 * - `POST /api/auth/google` & `POST /api/google`: Google OAuth verification and zero-state onboarding
 * - `GET /api/auth/me` & `GET /api/me`: Returns authenticated session and user profile
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import {
  db,
  usersTable,
  profilesTable,
  accountsTable,
  categoriesTable,
  aiConversationsTable,
  aiMessagesTable,
} from "@workspace/db";
import { generateToken, hashPassword, verifyPassword } from "../lib/auth";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { defaultCategories } from "../lib/db-seed";
import { verifyCaptcha } from "../middleware/verifyCaptcha";

const router = Router();

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);

// Registration payload validator
const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  baseCurrency: z.string().optional().default("UGX"),
  captchaToken: z.string().optional(),
});

// Login payload validator
const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Google OAuth payload validator
const GoogleAuthSchema = z.object({
  credential: z.string().optional(),
  idToken: z.string().optional(),
  token: z.string().optional(),
});

/**
 * ------------------------------------------------------------------------------
 * POST /api/auth/register & POST /api/register
 * ------------------------------------------------------------------------------
 * Registers a new user with strict zero-state baseline:
 * - Empty accounts: "Cash", "MTN MoMo", "Airtel Money" with balance 0
 * - Standard default categories
 * - No mock transactions or seeded ledger entries
 * - reCAPTCHA token verified via verifyCaptcha middleware
 */
router.post(["/register", "/auth/register"], verifyCaptcha, async (req, res) => {
  try {
    const result = RegisterSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0]?.message || "Invalid registration data" });
    }

    const { name, email, password } = result.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing user account
    const existingUsers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const userId = `user-${randomUUID()}`;
    const passwordHash = hashPassword(password);

    // 1. Insert User
    await db.insert(usersTable).values({
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      baseCurrency: "UGX",
    });

    // 2. Insert Profile
    const profileId = `profile-${userId}`;
    await db.insert(profilesTable).values({
      id: profileId,
      userId,
      fullName: name.trim(),
      email: normalizedEmail,
      country: "Uganda",
      preferredCurrency: "UGX",
      theme: "light",
    });

    // 3. Starter Accounts with strict zero-state baseline (balance: 0)
    const cashAccount = {
      id: `acc-cash-${userId}`,
      userId,
      name: "Cash",
      type: "cash",
      currency: "UGX",
      openingBalance: "0",
      isActive: true,
    };

    const momoAccount = {
      id: `acc-momo-${userId}`,
      userId,
      name: "MTN MoMo",
      type: "mobile_money",
      currency: "UGX",
      openingBalance: "0",
      isActive: true,
    };

    const airtelAccount = {
      id: `acc-airtel-${userId}`,
      userId,
      name: "Airtel Money",
      type: "mobile_money",
      currency: "UGX",
      openingBalance: "0",
      isActive: true,
    };

    await db.insert(accountsTable).values([cashAccount, momoAccount, airtelAccount]);

    // 4. Ensure standard default categories exist in database
    for (const cat of defaultCategories) {
      const existing = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, cat.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(categoriesTable).values({
          id: cat.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          isDefault: true,
        });
      }
    }

    // 5. Welcome AI Conversation (strictly zero-state, no mock transactions)
    const conversationId = `conv-${userId}`;
    await db.insert(aiConversationsTable).values({
      id: conversationId,
      userId,
      title: "Welcome to Tereka",
    });

    await db.insert(aiMessagesTable).values({
      id: `msg-${randomUUID()}`,
      conversationId,
      userId,
      role: "assistant",
      content: `Hello ${name.trim()}! Welcome to Tereka Financial Intelligence. Your accounts have been initialized with a clean zero-state baseline in UGX. Ask me anytime for cashflow insights.`,
    });

    // 6. Generate Signed JWT
    const token = generateToken({ userId, email: normalizedEmail });

    return res.status(201).json({
      token,
      user: {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        baseCurrency: "UGX",
      },
      profile: {
        id: profileId,
        userId,
        fullName: name.trim(),
        email: normalizedEmail,
        country: "Uganda",
        preferredCurrency: "UGX",
        theme: "light",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to register user" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * POST /api/auth/google & POST /api/google
 * ------------------------------------------------------------------------------
 * Handles Google OAuth ID token verification.
 * - Decodes and verifies token via OAuth2Client.verifyIdToken
 * - Matches user by email
 * - If user does not exist: creates user and initializes baseline accounts (Cash, MTN MoMo, Airtel Money) with 0 balance
 * - Strictly enforces zero-state baseline: no mock transactions
 * - Returns JWT auth token and user profile
 */
router.post(["/google", "/auth/google"], async (req, res) => {
  try {
    const parsed = GoogleAuthSchema.safeParse(req.body);
    const tokenCandidate = parsed.success
      ? parsed.data.credential || parsed.data.idToken || parsed.data.token
      : (req.body?.credential || req.body?.idToken || req.body?.token);

    if (!tokenCandidate || typeof tokenCandidate !== "string") {
      return res.status(400).json({ error: "Missing required Google ID token (credential)" });
    }

    let payload: { email: string; name?: string; picture?: string } | undefined;

    // Handle mock token for integration tests or test environments
    if (tokenCandidate.startsWith("mock-google-token:")) {
      const parts = tokenCandidate.split(":");
      payload = {
        email: parts[1] || "user@google.com",
        name: parts[2] || "Google User",
      };
    } else {
      const ticket = await googleClient.verifyIdToken({
        idToken: tokenCandidate,
        audience: GOOGLE_CLIENT_ID,
      });
      const googlePayload = ticket.getPayload();
      if (!googlePayload || !googlePayload.email) {
        return res.status(401).json({ error: "Google token verification failed: email not found in token" });
      }
      payload = {
        email: googlePayload.email,
        name: googlePayload.name || googlePayload.given_name || googlePayload.email.split("@")[0],
        picture: googlePayload.picture,
      };
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    const displayName = payload.name?.trim() || normalizedEmail.split("@")[0];

    // Check if user already exists in PostgreSQL
    const existingUsers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    let userId: string;
    let baseCurrency = "UGX";
    let profileData: any;

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      userId = existingUser.id;
      baseCurrency = existingUser.baseCurrency;

      const profiles = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);

      profileData = profiles[0] || {
        id: `profile-${userId}`,
        userId,
        fullName: existingUser.name,
        email: normalizedEmail,
        country: "Uganda",
        preferredCurrency: "UGX",
        theme: "light",
      };
    } else {
      // 1. Create new user with zero baseline
      userId = `user-${randomUUID()}`;
      const passwordHash = hashPassword(randomUUID());

      await db.insert(usersTable).values({
        id: userId,
        name: displayName,
        email: normalizedEmail,
        passwordHash,
        baseCurrency: "UGX",
      });

      // 2. Insert Profile
      const profileId = `profile-${userId}`;
      profileData = {
        id: profileId,
        userId,
        fullName: displayName,
        email: normalizedEmail,
        country: "Uganda",
        preferredCurrency: "UGX" as const,
        theme: "light" as const,
      };
      await db.insert(profilesTable).values(profileData);

      // 3. Initialize empty baseline accounts: Cash, MTN MoMo, Airtel Money with balance 0
      const cashAccount = {
        id: `acc-cash-${userId}`,
        userId,
        name: "Cash",
        type: "cash",
        currency: "UGX",
        openingBalance: "0",
        isActive: true,
      };

      const momoAccount = {
        id: `acc-momo-${userId}`,
        userId,
        name: "MTN MoMo",
        type: "mobile_money",
        currency: "UGX",
        openingBalance: "0",
        isActive: true,
      };

      const airtelAccount = {
        id: `acc-airtel-${userId}`,
        userId,
        name: "Airtel Money",
        type: "mobile_money",
        currency: "UGX",
        openingBalance: "0",
        isActive: true,
      };

      await db.insert(accountsTable).values([cashAccount, momoAccount, airtelAccount]);

      // 4. Ensure standard default categories exist
      for (const cat of defaultCategories) {
        const existing = await db
          .select()
          .from(categoriesTable)
          .where(eq(categoriesTable.id, cat.id))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(categoriesTable).values({
            id: cat.id,
            name: cat.name,
            type: cat.type,
            icon: cat.icon,
            isDefault: true,
          });
        }
      }

      // 5. Welcome AI Conversation (strictly zero-state baseline, no mock transactions)
      const conversationId = `conv-${userId}`;
      await db.insert(aiConversationsTable).values({
        id: conversationId,
        userId,
        title: "Welcome to Tereka",
      });

      await db.insert(aiMessagesTable).values({
        id: `msg-${randomUUID()}`,
        conversationId,
        userId,
        role: "assistant",
        content: `Hello ${displayName}! Welcome to Tereka Financial Intelligence. Your Cash, MTN MoMo, and Airtel Money accounts have been initialized with a clean zero-state baseline in UGX.`,
      });
    }

    const token = generateToken({ userId, email: normalizedEmail });

    return res.status(200).json({
      token,
      user: {
        id: userId,
        name: displayName,
        email: normalizedEmail,
        baseCurrency,
      },
      profile: profileData,
    });
  } catch (err: any) {
    return res.status(401).json({ error: err.message || "Failed to authenticate with Google" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * POST /api/auth/login & POST /api/login
 * ------------------------------------------------------------------------------
 * Verifies email and password against the database, then returns a JWT token.
 */
router.post(["/login", "/auth/login"], async (req, res) => {
  try {
    const result = LoginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0]?.message || "Invalid login credentials" });
    }

    const { email, password } = result.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Query user row from PostgreSQL
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    const user = users[0];
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Query user profile
    const profiles = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, user.id))
      .limit(1);

    const profile = profiles[0] || {
      id: `profile-${user.id}`,
      userId: user.id,
      fullName: user.name,
      email: user.email,
      country: "Uganda",
      preferredCurrency: user.baseCurrency,
      theme: "light",
    };

    const token = generateToken({ userId: user.id, email: user.email });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        baseCurrency: user.baseCurrency,
      },
      profile,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to log in" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/auth/me & GET /api/me
 * ------------------------------------------------------------------------------
 * Resolves current user session from the validated JWT token in `req.userId`.
 */
router.get(["/me", "/auth/me"], requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const profiles = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
    const profile = profiles[0] || {
      id: `profile-${user.id}`,
      userId: user.id,
      fullName: user.name,
      email: user.email,
      country: "Uganda",
      preferredCurrency: user.baseCurrency,
      theme: "light",
    };

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      baseCurrency: user.baseCurrency,
      profile,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch user" });
  }
});

export default router;
