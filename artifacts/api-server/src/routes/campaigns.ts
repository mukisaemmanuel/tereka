/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - CAMPAIGNS & EVENT FUNDRAISING API
 * ==============================================================================
 * 
 * Handles community fundraising campaigns (Kwanjula, Weddings, Mabugo, Medical, etc.)
 * with event image/flyer support, public contribution portals, and wallet settlement.
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  campaignsTable,
  campaignContributionsTable,
  usersTable,
  profilesTable,
  accountsTable,
  ledgerEntriesTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = randomUUID().slice(0, 6);
  return `${base || "event"}-${suffix}`;
}

const CreateCampaignSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["kwanjula", "wedding", "mabugo", "medical", "graduation", "general"]).default("general"),
  targetAmount: z.number().int().positive("Target amount must be greater than 0"),
  currency: z.string().default("UGX"),
  deadline: z.string().optional(),
  accountId: z.string().optional(),
  recipientPhone: z.string().optional(),
  recipientName: z.string().optional(),
  imageUrl: z.string().optional(),
  status: z.enum(["active", "completed", "paused"]).default("active"),
});

const CreateContributionSchema = z.object({
  contributorName: z.string().min(1, "Name is required"),
  contributorPhone: z.string().optional(),
  amount: z.number().int().positive("Contribution amount must be greater than 0"),
  currency: z.string().default("UGX"),
  paymentMethod: z.enum(["mtn_momo", "airtel_money", "bank_transfer", "cash"]).default("mtn_momo"),
  reference: z.string().optional(),
  message: z.string().optional(),
  isAnonymous: z.boolean().default(false),
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/campaigns
 * ------------------------------------------------------------------------------
 * Lists all fundraising campaigns owned by the authenticated user.
 */
router.get("/campaigns", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const campaigns = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.userId, userId))
      .orderBy(desc(campaignsTable.createdAt));

    const contributions = await db.select().from(campaignContributionsTable);

    const enriched = campaigns.map((campaign) => {
      const related = contributions.filter((c) => c.campaignId === campaign.id);
      const totalRaised = related.reduce((sum, c) => sum + c.amount, 0);
      const percentageComplete = campaign.targetAmount > 0
        ? Math.min(100, Math.round((totalRaised / campaign.targetAmount) * 100))
        : 0;

      return {
        ...campaign,
        totalRaised,
        remainingAmount: Math.max(0, campaign.targetAmount - totalRaised),
        contributorsCount: related.length,
        percentageComplete,
      };
    });

    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch campaigns" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * POST /api/campaigns
 * ------------------------------------------------------------------------------
 * Creates a new event campaign with flyer image URL / data URL and payout phone number.
 */
router.post("/campaigns", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const parsed = CreateCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid campaign data" });
    }

    const data = parsed.data;
    const campaignId = `campaign-${randomUUID()}`;
    const slug = slugify(data.title);

    await db.insert(campaignsTable).values({
      id: campaignId,
      userId,
      slug,
      title: data.title.trim(),
      description: data.description ? data.description.trim() : null,
      type: data.type,
      targetAmount: data.targetAmount,
      currency: "UGX",
      deadline: data.deadline || null,
      accountId: data.accountId || null,
      recipientPhone: data.recipientPhone ? data.recipientPhone.trim() : null,
      recipientName: data.recipientName ? data.recipientName.trim() : null,
      imageUrl: data.imageUrl || null,
      status: data.status,
    });

    const [created] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId)).limit(1);

    return res.status(201).json({
      ...created,
      totalRaised: 0,
      remainingAmount: created.targetAmount,
      contributorsCount: 0,
      percentageComplete: 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create campaign" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/campaigns/:id
 * ------------------------------------------------------------------------------
 * Returns full campaign details including contributor ledger.
 */
router.get("/campaigns/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, id))
      .limit(1);

    if (!campaign || campaign.userId !== userId) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const contributions = await db
      .select()
      .from(campaignContributionsTable)
      .where(eq(campaignContributionsTable.campaignId, id))
      .orderBy(desc(campaignContributionsTable.paidAt));

    const totalRaised = contributions.reduce((sum, c) => sum + c.amount, 0);
    const percentageComplete = campaign.targetAmount > 0
      ? Math.min(100, Math.round((totalRaised / campaign.targetAmount) * 100))
      : 0;

    return res.json({
      ...campaign,
      totalRaised,
      remainingAmount: Math.max(0, campaign.targetAmount - totalRaised),
      contributorsCount: contributions.length,
      percentageComplete,
      contributions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load campaign" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * DELETE /api/campaigns/:id
 * ------------------------------------------------------------------------------
 * Deletes a campaign and its contributions.
 */
router.delete("/campaigns/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
    if (!campaign || campaign.userId !== userId) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    await db.delete(campaignContributionsTable).where(eq(campaignContributionsTable.campaignId, id));
    await db.delete(campaignsTable).where(eq(campaignsTable.id, id));

    return res.json({ success: true, message: "Campaign deleted" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to delete campaign" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * GET /api/public/campaigns/:slug
 * ------------------------------------------------------------------------------
 * Public endpoint for friends, family, and contributors to view event details.
 */
router.get("/public/campaigns/:slug", async (req, res) => {
  try {
    const slug = req.params.slug as string;
    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.slug, slug))
      .limit(1);

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Get organizer details
    const [organizerProfile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, campaign.userId))
      .limit(1);

    const [organizerUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, campaign.userId))
      .limit(1);

    const organizerName = organizerProfile?.fullName || organizerUser?.name || "Event Organizer";

    // Linked payout account info (e.g. MTN MoMo or Airtel Money number if applicable)
    let destinationAccountName: string | null = null;
    if (campaign.accountId) {
      const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, campaign.accountId)).limit(1);
      if (acc) {
        destinationAccountName = acc.name;
      }
    }

    const contributions = await db
      .select()
      .from(campaignContributionsTable)
      .where(eq(campaignContributionsTable.campaignId, campaign.id))
      .orderBy(desc(campaignContributionsTable.paidAt));

    const totalRaised = contributions.reduce((sum, c) => sum + c.amount, 0);
    const percentageComplete = campaign.targetAmount > 0
      ? Math.min(100, Math.round((totalRaised / campaign.targetAmount) * 100))
      : 0;

    const publicContributions = contributions.map((c) => ({
      id: c.id,
      contributorName: c.isAnonymous ? "Well-Wisher (Anonymous)" : c.contributorName,
      amount: c.amount,
      currency: c.currency,
      paymentMethod: c.paymentMethod,
      message: c.message,
      paidAt: c.paidAt,
    }));

    return res.json({
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      description: campaign.description,
      type: campaign.type,
      targetAmount: campaign.targetAmount,
      currency: campaign.currency,
      deadline: campaign.deadline,
      recipientPhone: campaign.recipientPhone,
      recipientName: campaign.recipientName,
      imageUrl: campaign.imageUrl,
      status: campaign.status,
      organizerName,
      destinationAccountName,
      totalRaised,
      remainingAmount: Math.max(0, campaign.targetAmount - totalRaised),
      contributorsCount: contributions.length,
      percentageComplete,
      contributions: publicContributions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load public campaign" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * POST /api/public/campaigns/:slug/contribute
 * ------------------------------------------------------------------------------
 * Public endpoint to log a mobile money / cash contribution toward an event.
 */
router.post("/public/campaigns/:slug/contribute", async (req, res) => {
  try {
    const slug = req.params.slug as string;
    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.slug, slug))
      .limit(1);

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (campaign.status !== "active") {
      return res.status(400).json({ error: "This campaign is no longer accepting contributions." });
    }

    const parsed = CreateContributionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid contribution data" });
    }

    const data = parsed.data;
    const contributionId = `contrib-${randomUUID()}`;

    await db.insert(campaignContributionsTable).values({
      id: contributionId,
      campaignId: campaign.id,
      contributorName: data.contributorName.trim(),
      contributorPhone: data.contributorPhone ? data.contributorPhone.trim() : null,
      amount: data.amount,
      currency: "UGX",
      paymentMethod: data.paymentMethod,
      reference: data.reference ? data.reference.trim() : `MOMO-${randomUUID().slice(0, 8).toUpperCase()}`,
      message: data.message ? data.message.trim() : null,
      isAnonymous: data.isAnonymous,
      paidAt: new Date(),
    });

    // If destination account exists, credit wallet in ledger
    if (campaign.accountId) {
      await db.insert(ledgerEntriesTable).values({
        id: `led-${randomUUID()}`,
        userId: campaign.userId,
        transactionId: contributionId,
        accountId: campaign.accountId,
        amount: data.amount,
        direction: "credit",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Thank you! Your contribution has been recorded.",
      contributionId,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to record contribution" });
  }
});

export default router;
