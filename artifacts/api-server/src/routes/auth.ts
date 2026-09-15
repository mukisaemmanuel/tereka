import { Router } from "express";
import { z } from "zod";
import { generateToken, hashPassword, verifyPassword } from "../lib/auth";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import {
  createUser,
  findUserByEmail,
  findUserById,
  getProfile,
  type CurrencyCode,
} from "../services/finance-store";

const router = Router();

const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  baseCurrency: z.enum(["UGX", "KES", "TZS", "RWF", "USD"]).optional(),
});

const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// POST /api/register
router.post("/register", (req, res) => {
  const result = RegisterSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0]?.message || "Invalid registration data" });
  }

  const { name, email, password, baseCurrency } = result.data;

  const existingUser = findUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = hashPassword(password);
  const user = createUser({
    name,
    email,
    passwordHash,
    baseCurrency: (baseCurrency as CurrencyCode) || "UGX",
  });

  const token = generateToken({ userId: user.id, email: user.email });
  const profile = getProfile(user.id);

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      baseCurrency: user.baseCurrency,
    },
    profile,
  });
});

// POST /api/login
router.post("/login", (req, res) => {
  const result = LoginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0]?.message || "Invalid login credentials" });
  }

  const { email, password } = result.data;
  const user = findUserByEmail(email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = generateToken({ userId: user.id, email: user.email });
  const profile = getProfile(user.id);

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
});

// GET /api/me
router.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const user = findUserById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const profile = getProfile(userId);

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    baseCurrency: user.baseCurrency,
    profile,
  });
});

export default router;
