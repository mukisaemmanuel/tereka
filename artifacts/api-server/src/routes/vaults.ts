/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - VAULTS & SACCO API
 * ==============================================================================
 * 
 * Implements Locked Group & Family Savings (Tereka Vaults) with Destination Voting:
 * - Time locks and target balance locks
 * - Payout Proposals & Destination Ballots (Vendor Bank, MoMo Number, Member Split)
 * - Member voting with 1-vote-per-member enforcement and automatic approval threshold
 * - Transparent member contribution tracking and vault ledger
 */

import { Router, type Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import {
  db,
  vaultsTable,
  vaultMembersTable,
  vaultLedgerTable,
  vaultPayoutProposalsTable,
  vaultMemberVotesTable,
  usersTable,
  profilesTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// Enforce auth on all vault endpoints
router.use(requireAuth);

const CreateVaultSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  targetAmount: z.number().int().positive("Target amount must be greater than 0"),
  currency: z.string().default("UGX"),
  lockType: z.enum(["time_locked", "target_locked", "both"]).default("time_locked"),
  unlockDate: z.string().optional(),
  minSignaturesRequired: z.number().int().min(1).max(10).default(2),
});

const AddMemberSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(6, "Valid phone number is required"),
  role: z.enum(["chairman", "treasurer", "keyholder", "member"]).default("member"),
  targetContribution: z.number().int().min(0).default(0),
});

const ContributeSchema = z.object({
  memberId: z.string().optional(),
  memberName: z.string().min(1, "Member name is required"),
  amount: z.number().int().positive("Amount must be greater than 0"),
  currency: z.string().default("UGX"),
  paymentMethod: z.enum(["mtn_momo", "airtel_money", "bank_transfer", "cash"]).default("mtn_momo"),
  reference: z.string().optional(),
  note: z.string().optional(),
});

const CreateProposalSchema = z.object({
  title: z.string().min(2, "Title or purpose is required"),
  amount: z.number().int().positive("Amount must be greater than 0"),
  destinationType: z.enum(["vendor_bank", "momo_number", "split_equally_to_members"]).default("momo_number"),
  recipientName: z.string().min(2, "Recipient name is required"),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  phone: z.string().optional(),
});

const CastVoteSchema = z.object({
  vote: z.enum(["yes", "no"]),
  comment: z.string().optional(),
});

/**
 * ------------------------------------------------------------------------------
 * 1. POST /api/vaults
 * Create a new locked group/family savings vault.
 * ------------------------------------------------------------------------------
 */
router.post("/vaults", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const parsed = CreateVaultSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { title, description, targetAmount, currency, lockType, unlockDate, minSignaturesRequired } = parsed.data;

    const vaultId = `vault-${randomUUID()}`;

    // Look up creator info for member roster
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);

    const creatorName = profile?.fullName || user?.name || "Vault Chairman";
    const creatorPhone = profile?.phoneNumber || "0770000000";

    const [createdVault] = await db
      .insert(vaultsTable)
      .values({
        id: vaultId,
        userId,
        title,
        description: description || null,
        targetAmount,
        currentAmount: 0,
        currency,
        lockType,
        unlockDate: unlockDate || null,
        minSignaturesRequired,
        status: "active",
      })
      .returning();

    // Auto-add creator as Chairman
    const memberId = `vmem-${randomUUID()}`;
    await db.insert(vaultMembersTable).values({
      id: memberId,
      vaultId,
      userId,
      name: creatorName,
      phone: creatorPhone,
      role: "chairman",
      targetContribution: 0,
      totalContributed: 0,
    });

    res.status(201).json({
      message: "Vault created successfully",
      vault: createdVault,
    });
  } catch (err) {
    console.error("Error creating vault:", err);
    res.status(500).json({ error: "Failed to create vault" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * 2. GET /api/vaults
 * List all vaults where user is creator or member.
 * ------------------------------------------------------------------------------
 */
router.get("/vaults", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const creatorVaults = await db
      .select()
      .from(vaultsTable)
      .where(eq(vaultsTable.userId, userId))
      .orderBy(desc(vaultsTable.createdAt));

    const memberRecords = await db
      .select({ vaultId: vaultMembersTable.vaultId })
      .from(vaultMembersTable)
      .where(eq(vaultMembersTable.userId, userId));

    const memberVaultIds = memberRecords.map((m) => m.vaultId);
    let allVaults = [...creatorVaults];

    if (memberVaultIds.length > 0) {
      const additionalVaults = await db
        .select()
        .from(vaultsTable)
        .where(inArray(vaultsTable.id, memberVaultIds));

      const existingIds = new Set(allVaults.map((v) => v.id));
      for (const v of additionalVaults) {
        if (!existingIds.has(v.id)) {
          allVaults.push(v);
        }
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    const enrichedVaults = await Promise.all(
      allVaults.map(async (v) => {
        const members = await db
          .select()
          .from(vaultMembersTable)
          .where(eq(vaultMembersTable.vaultId, v.id));

        const activeProposals = await db
          .select()
          .from(vaultPayoutProposalsTable)
          .where(and(eq(vaultPayoutProposalsTable.vaultId, v.id), eq(vaultPayoutProposalsTable.status, "voting_active")));

        const isTimeLocked =
          (v.lockType === "time_locked" || v.lockType === "both") &&
          v.unlockDate !== null &&
          v.unlockDate > today;

        const isTargetLocked =
          (v.lockType === "target_locked" || v.lockType === "both") &&
          v.currentAmount < v.targetAmount;

        const isLocked = isTimeLocked || isTargetLocked;

        const userMember = members.find((m) => m.userId === userId);
        const userRole = userMember ? userMember.role : v.userId === userId ? "chairman" : "viewer";

        const percentageComplete = Math.min(
          100,
          Math.round((v.currentAmount / Math.max(1, v.targetAmount)) * 100)
        );

        return {
          ...v,
          membersCount: members.length,
          percentageComplete,
          remainingAmount: Math.max(0, v.targetAmount - v.currentAmount),
          isLocked,
          isTimeLocked,
          isTargetLocked,
          userRole,
          activeProposalsCount: activeProposals.length,
        };
      })
    );

    const totalLockedSavings = enrichedVaults.reduce((sum, v) => sum + (v.currentAmount || 0), 0);
    const totalMembersCount = enrichedVaults.reduce((sum, v) => sum + v.membersCount, 0);
    const pendingBallotsCount = enrichedVaults.reduce((sum, v) => sum + v.activeProposalsCount, 0);

    res.json({
      vaults: enrichedVaults,
      totalLockedSavings,
      activeVaultsCount: enrichedVaults.length,
      totalMembersCount,
      pendingBallotsCount,
    });
  } catch (err) {
    console.error("Error fetching vaults:", err);
    res.status(500).json({ error: "Failed to fetch vaults" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * 3. GET /api/vaults/:id
 * Retrieve specific vault details, member roster, ledger, and payout proposals.
 * ------------------------------------------------------------------------------
 */
router.get("/vaults/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const [vault] = await db.select().from(vaultsTable).where(eq(vaultsTable.id, id)).limit(1);
    if (!vault) {
      res.status(404).json({ error: "Vault not found" });
      return;
    }

    const members = await db
      .select()
      .from(vaultMembersTable)
      .where(eq(vaultMembersTable.vaultId, id))
      .orderBy(vaultMembersTable.createdAt);

    const ledger = await db
      .select()
      .from(vaultLedgerTable)
      .where(eq(vaultLedgerTable.vaultId, id))
      .orderBy(desc(vaultLedgerTable.createdAt))
      .limit(50);

    const proposals = await db
      .select()
      .from(vaultPayoutProposalsTable)
      .where(eq(vaultPayoutProposalsTable.vaultId, id))
      .orderBy(desc(vaultPayoutProposalsTable.createdAt));

    const userMember = members.find((m) => m.userId === userId) || (vault.userId === userId ? {
      id: "creator",
      name: "Chairman",
      role: "chairman",
    } : null);

    const userRole = userMember ? userMember.role : "viewer";

    const enrichedProposals = await Promise.all(
      proposals.map(async (p) => {
        const votes = await db
          .select()
          .from(vaultMemberVotesTable)
          .where(eq(vaultMemberVotesTable.proposalId, p.id))
          .orderBy(desc(vaultMemberVotesTable.createdAt));

        const userVote = userMember ? votes.find((v) => v.memberId === userMember.id) : null;

        return {
          ...p,
          votes,
          hasUserVoted: !!userVote,
          userVote: userVote?.vote || null,
        };
      })
    );

    const today = new Date().toISOString().slice(0, 10);
    const isTimeLocked =
      (vault.lockType === "time_locked" || vault.lockType === "both") &&
      vault.unlockDate !== null &&
      vault.unlockDate > today;

    const isTargetLocked =
      (vault.lockType === "target_locked" || vault.lockType === "both") &&
      vault.currentAmount < vault.targetAmount;

    const isLocked = isTimeLocked || isTargetLocked;

    const percentageComplete = Math.min(
      100,
      Math.round((vault.currentAmount / Math.max(1, vault.targetAmount)) * 100)
    );

    res.json({
      vault: {
        ...vault,
        percentageComplete,
        remainingAmount: Math.max(0, vault.targetAmount - vault.currentAmount),
        isLocked,
        isTimeLocked,
        isTargetLocked,
        userRole,
        userMemberId: userMember?.id,
      },
      members,
      ledger,
      proposals: enrichedProposals,
    });
  } catch (err) {
    console.error("Error fetching vault details:", err);
    res.status(500).json({ error: "Failed to fetch vault details" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * 4. POST /api/vaults/:id/members
 * Add a member to a vault (name, phone, role, targetContribution).
 * ------------------------------------------------------------------------------
 */
router.post("/vaults/:id/members", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parsed = AddMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const [vault] = await db.select().from(vaultsTable).where(eq(vaultsTable.id, id)).limit(1);
    if (!vault) {
      res.status(404).json({ error: "Vault not found" });
      return;
    }

    const { name, phone, role, targetContribution } = parsed.data;

    let matchedUserId: string | null = null;
    const [matchedProfile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.phoneNumber, phone))
      .limit(1);

    if (matchedProfile) {
      matchedUserId = matchedProfile.userId;
    }

    const memberId = `vmem-${randomUUID()}`;
    const [newMember] = await db
      .insert(vaultMembersTable)
      .values({
        id: memberId,
        vaultId: id,
        userId: matchedUserId,
        name,
        phone,
        role,
        targetContribution,
        totalContributed: 0,
      })
      .returning();

    res.status(201).json({
      message: "Member added successfully",
      member: newMember,
    });
  } catch (err) {
    console.error("Error adding vault member:", err);
    res.status(500).json({ error: "Failed to add member" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * 5. POST /api/vaults/:id/contribute
 * Record a deposit into the vault. Updates currentAmount and creates ledger entry.
 * ------------------------------------------------------------------------------
 */
router.post("/vaults/:id/contribute", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parsed = ContributeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const [vault] = await db.select().from(vaultsTable).where(eq(vaultsTable.id, id)).limit(1);
    if (!vault) {
      res.status(404).json({ error: "Vault not found" });
      return;
    }

    const { memberId, memberName, amount, currency, paymentMethod, reference, note } = parsed.data;

    const ledgerId = `vtx-${randomUUID()}`;
    const [entry] = await db
      .insert(vaultLedgerTable)
      .values({
        id: ledgerId,
        vaultId: id,
        memberId: memberId || null,
        memberName,
        type: "deposit",
        amount,
        currency,
        paymentMethod,
        reference: reference || null,
        note: note || null,
      })
      .returning();

    if (memberId) {
      await db
        .update(vaultMembersTable)
        .set({
          totalContributed: sql`${vaultMembersTable.totalContributed} + ${amount}`,
        })
        .where(eq(vaultMembersTable.id, memberId));
    }

    const [updatedVault] = await db
      .update(vaultsTable)
      .set({
        currentAmount: sql`${vaultsTable.currentAmount} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(vaultsTable.id, id))
      .returning();

    res.status(201).json({
      message: "Contribution recorded successfully",
      ledgerEntry: entry,
      vault: updatedVault,
    });
  } catch (err) {
    console.error("Error recording vault contribution:", err);
    res.status(500).json({ error: "Failed to record contribution" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * 6. POST /api/vaults/:id/proposals
 * Any member can propose a payout destination with details.
 * ------------------------------------------------------------------------------
 */
router.post("/vaults/:id/proposals", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const parsed = CreateProposalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const [vault] = await db.select().from(vaultsTable).where(eq(vaultsTable.id, id)).limit(1);
    if (!vault) {
      res.status(404).json({ error: "Vault not found" });
      return;
    }

    // Look up proposer member record
    const members = await db.select().from(vaultMembersTable).where(eq(vaultMembersTable.vaultId, id));
    const proposer = members.find((m) => m.userId === userId) || (vault.userId === userId ? {
      id: "creator",
      name: "Chairman",
      role: "chairman",
    } : null);

    if (!proposer) {
      res.status(403).json({ error: "Only registered vault members can propose a payout destination" });
      return;
    }

    const { title, amount, destinationType, recipientName, bankName, accountNumber, phone } = parsed.data;

    if (amount > vault.currentAmount) {
      res.status(400).json({
        error: `Requested amount (UGX ${amount.toLocaleString()}) exceeds locked vault balance (UGX ${vault.currentAmount.toLocaleString()})`,
      });
      return;
    }

    const proposalId = `vprop-${randomUUID()}`;
    const [proposal] = await db
      .insert(vaultPayoutProposalsTable)
      .values({
        id: proposalId,
        vaultId: id,
        proposerMemberId: proposer.id,
        proposerName: proposer.name,
        title,
        amount,
        currency: vault.currency,
        destinationType,
        recipientName,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        phone: phone || null,
        status: "voting_active",
        requiredVotes: vault.minSignaturesRequired,
        yesVotesCount: 0,
        noVotesCount: 0,
      })
      .returning();

    res.status(201).json({
      message: "Payout destination proposal submitted for member ballot voting",
      proposal,
    });
  } catch (err) {
    console.error("Error creating payout proposal:", err);
    res.status(500).json({ error: "Failed to create payout proposal" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * 7. GET /api/vaults/:id/proposals
 * List all active and historical ballots for this vault.
 * ------------------------------------------------------------------------------
 */
router.get("/vaults/:id/proposals", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const proposals = await db
      .select()
      .from(vaultPayoutProposalsTable)
      .where(eq(vaultPayoutProposalsTable.vaultId, id))
      .orderBy(desc(vaultPayoutProposalsTable.createdAt));

    const members = await db.select().from(vaultMembersTable).where(eq(vaultMembersTable.vaultId, id));
    const userMember = members.find((m) => m.userId === userId);

    const enriched = await Promise.all(
      proposals.map(async (p) => {
        const votes = await db
          .select()
          .from(vaultMemberVotesTable)
          .where(eq(vaultMemberVotesTable.proposalId, p.id))
          .orderBy(desc(vaultMemberVotesTable.createdAt));

        const userVote = userMember ? votes.find((v) => v.memberId === userMember.id) : null;

        return {
          ...p,
          votes,
          hasUserVoted: !!userVote,
          userVote: userVote?.vote || null,
        };
      })
    );

    res.json({ proposals: enriched });
  } catch (err) {
    console.error("Error fetching proposals:", err);
    res.status(500).json({ error: "Failed to fetch proposals" });
  }
});

/**
 * ------------------------------------------------------------------------------
 * 8. POST /api/vaults/proposals/:proposalId/vote
 * Cast a vote ('yes' or 'no'). Enforces 1 vote per member.
 * If yesVotesCount >= requiredVotes, automatically marks proposal as 'approved'.
 * ------------------------------------------------------------------------------
 */
router.post("/vaults/proposals/:proposalId/vote", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { proposalId } = req.params;

    const parsed = CastVoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const [proposal] = await db
      .select()
      .from(vaultPayoutProposalsTable)
      .where(eq(vaultPayoutProposalsTable.id, proposalId))
      .limit(1);

    if (!proposal) {
      res.status(404).json({ error: "Payout proposal not found" });
      return;
    }

    if (proposal.status !== "voting_active") {
      res.status(400).json({ error: `Voting is closed. Proposal is already ${proposal.status}.` });
      return;
    }

    const [vault] = await db
      .select()
      .from(vaultsTable)
      .where(eq(vaultsTable.id, proposal.vaultId))
      .limit(1);

    if (!vault) {
      res.status(404).json({ error: "Vault not found" });
      return;
    }

    const members = await db.select().from(vaultMembersTable).where(eq(vaultMembersTable.vaultId, vault.id));
    const voter = members.find((m) => m.userId === userId) || (vault.userId === userId ? {
      id: "creator",
      name: "Chairman",
      role: "chairman",
    } : null);

    if (!voter) {
      res.status(403).json({ error: "Only members of this vault can vote on destination ballots" });
      return;
    }

    // Check if voter already voted (1 vote per member)
    const existingVote = await db
      .select()
      .from(vaultMemberVotesTable)
      .where(
        and(
          eq(vaultMemberVotesTable.proposalId, proposalId),
          eq(vaultMemberVotesTable.memberId, voter.id)
        )
      )
      .limit(1);

    if (existingVote.length > 0) {
      res.status(400).json({ error: "You have already cast your ballot on this proposal" });
      return;
    }

    const { vote, comment } = parsed.data;

    // Record vote
    await db.insert(vaultMemberVotesTable).values({
      id: `vvote-${randomUUID()}`,
      proposalId,
      memberId: voter.id,
      memberName: voter.name,
      vote,
      comment: comment || null,
    });

    // Recompute vote tallies
    const allVotes = await db
      .select()
      .from(vaultMemberVotesTable)
      .where(eq(vaultMemberVotesTable.proposalId, proposalId));

    const yesCount = allVotes.filter((v) => v.vote === "yes").length;
    const noCount = allVotes.filter((v) => v.vote === "no").length;

    let newStatus: "voting_active" | "approved" | "rejected" | "disbursed" = "voting_active";
    let disbursedAt: Date | null = null;

    if (yesCount >= proposal.requiredVotes) {
      newStatus = "approved";
      disbursedAt = new Date();

      // Deduct from vault balance
      await db
        .update(vaultsTable)
        .set({
          currentAmount: sql`GREATEST(0, ${vaultsTable.currentAmount} - ${proposal.amount})`,
          updatedAt: new Date(),
        })
        .where(eq(vaultsTable.id, vault.id));

      // Record in immutable vault ledger
      const destSummary = proposal.destinationType === "vendor_bank"
        ? `${proposal.bankName || "Bank"}: ${proposal.accountNumber}`
        : proposal.destinationType === "momo_number"
        ? `MoMo: ${proposal.phone}`
        : "Equal Split to Members";

      await db.insert(vaultLedgerTable).values({
        id: `vtx-${randomUUID()}`,
        vaultId: vault.id,
        memberId: voter.id,
        memberName: voter.name,
        type: "payout",
        amount: proposal.amount,
        currency: proposal.currency,
        paymentMethod: proposal.destinationType === "vendor_bank" ? "bank_transfer" : "mtn_momo",
        reference: `VOTE-APPROVED-${proposalId.slice(0, 8).toUpperCase()}`,
        note: `Approved payout to ${proposal.recipientName} (${destSummary}) for ${proposal.title}`,
      });
    }

    const [updatedProposal] = await db
      .update(vaultPayoutProposalsTable)
      .set({
        yesVotesCount: yesCount,
        noVotesCount: noCount,
        status: newStatus,
        disbursedAt: disbursedAt ? disbursedAt : proposal.disbursedAt,
        updatedAt: new Date(),
      })
      .where(eq(vaultPayoutProposalsTable.id, proposalId))
      .returning();

    res.json({
      message: newStatus === "approved"
        ? `Destination approved with ${yesCount} 'Yes' votes! Funds have been disbursed to ${proposal.recipientName}.`
        : `Vote recorded. Current tally: ${yesCount} Yes / ${noCount} No (Need ${proposal.requiredVotes} Yes votes).`,
      proposal: updatedProposal,
      approved: newStatus === "approved",
    });
  } catch (err) {
    console.error("Error casting proposal vote:", err);
    res.status(500).json({ error: "Failed to cast vote" });
  }
});

export default router;
