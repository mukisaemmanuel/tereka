/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - AUTHENTICATION API ROUTES
 * ==============================================================================
 * 
 * Handles user onboarding, password verification, JWT issuance, and profile resolution.
 * All operations execute directly against PostgreSQL tables via Drizzle ORM.
 * 
 * Endpoints:
 * - `POST /api/register`: Creates user account, profile, starter accounts, and budgets
 * - `POST /api/login`: Validates credentials against PBKDF2 password hashes and issues JWT
 * - `GET /api/me`: Returns the authenticated user and profile information
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  profilesTable,
  accountsTable,
  budgetsTable,
  financialGoalsTable,
  aiConversationsTable,
  aiMessagesTable,
} from "@workspace/db";
import { generateToken, hashPassword, verifyPassword } from "../lib/auth";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { defaultCategoryIds } from "../lib/db-seed";

const router = Router();

// Registration payload validator
const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  baseCurrency: z.string().optional().default("UGX"),
});

// Login payload validator
const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

/**
 * ------------------------------------------------------------------------------
 * POST /api/register
 * ------------------------------------------------------------------------------
 * Registers a new user in PostgreSQL and provisions essential starter financial data:
 * 1. Inserts into `users` table with a secure cryptographic hash.
 * 2. Inserts into `profiles` with country and currency defaults (Uganda / UGX).
 * 3. Creates starter Ugandan wallets: "Physical Cash" and "MTN MoMo" in UGX.
 * 4. Configures starter monthly budgets for Food, Transport, and Utilities in UGX.
 * 5. Sets up an initial Emergency Fund goal and a welcome AI conversation.
 * 6. Returns a signed JWT token and user profile.
 */
router.post("/register", async (req, res) => {
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

    // 3. Starter Wallets (Mobile Money & Cash)
    const cashAccount = {
      id: `acc-cash-${userId}`,
      userId,
      name: "Physical Cash",
      type: "cash",
      currency: "UGX",
      openingBalance: "50000",
      isActive: true,
    };

    const momoAccount = {
      id: `acc-momo-${userId}`,
      userId,
      name: "MTN MoMo",
      type: "mobile_money",
      currency: "UGX",
      openingBalance: "200000",
      isActive: true,
    };

    await db.insert(accountsTable).values([cashAccount, momoAccount]);

    // 4. Starter Budgets
    await db.insert(budgetsTable).values([
      {
        id: `budget-food-${userId}`,
        userId,
        categoryId: defaultCategoryIds.food,
        amount: "300000",
        currency: "UGX",
        period: "monthly",
      },
      {
        id: `budget-transport-${userId}`,
        userId,
        categoryId: defaultCategoryIds.transport,
        amount: "150000",
        currency: "UGX",
        period: "monthly",
      },
      {
        id: `budget-utilities-${userId}`,
        userId,
        categoryId: defaultCategoryIds.utilities,
        amount: "100000",
        currency: "UGX",
        period: "monthly",
      },
    ]);

    // 5. Starter Emergency Goal
    await db.insert(financialGoalsTable).values({
      id: `goal-emergency-${userId}`,
      userId,
      name: "Emergency Reserve Fund",
      targetAmount: "2000000",
      currentAmount: "250000",
      currency: "UGX",
      targetDate: "2027-06-30",
      status: "active",
    });

    // 6. Welcome AI Conversation
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
      content: `Hello ${name.trim()}! Welcome to Tereka Financial Intelligence. Your starter accounts and budgets in UGX are configured in PostgreSQL. Ask me anytime for cashflow insights.`,
    });

    // 7. Generate Signed JWT
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
 * POST /api/login
 * ------------------------------------------------------------------------------
 * Verifies email and password against the database, then returns a JWT token.
 */
router.post("/login", async (req, res) => {
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
 * GET /api/me
 * ------------------------------------------------------------------------------
 * Resolves current user session from the validated JWT token in `req.userId`.
 */
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
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
