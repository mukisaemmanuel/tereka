/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - VAULTS & SACCO DATABASE SCHEMA (DRIZZLE ORM)
 * ==============================================================================
 * 
 * Defines schemas for locked group and family savings (Tereka Vaults).
 * Features:
 * - Time locks and target balance locks
 * - Destination voting on payout proposals (Vendor Bank, MoMo Number, Member Split)
 * - Transparent member contribution tracking and multi-member ballot ledger
 */

import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./finance";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * ------------------------------------------------------------------------------
 * 1. VAULTS TABLE
 * ------------------------------------------------------------------------------
 * Group/family savings vault instance.
 */
export const vaultsTable = pgTable("vaults", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  targetAmount: integer("target_amount").notNull(), // Target in UGX
  currentAmount: integer("current_amount").notNull().default(0), // Balance in UGX
  currency: text("currency").notNull().default("UGX"),
  lockType: text("lock_type").notNull().default("time_locked"), // 'time_locked' | 'target_locked' | 'both'
  unlockDate: text("unlock_date"), // ISO date string: 'YYYY-MM-DD'
  minSignaturesRequired: integer("min_signatures_required").notNull().default(2),
  status: text("status").notNull().default("active"), // 'active' | 'unlocked' | 'archived'
  ...timestamps,
});

/**
 * ------------------------------------------------------------------------------
 * 2. VAULT MEMBERS TABLE
 * ------------------------------------------------------------------------------
 * Registered participants in a vault.
 */
export const vaultMembersTable = pgTable("vault_members", {
  id: text("id").primaryKey(),
  vaultId: text("vault_id").notNull().references(() => vaultsTable.id, { onDelete: "cascade" }),
  userId: text("user_id"), // Optional reference if matched to a registered Tereka user
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: text("role").notNull().default("member"), // 'chairman' | 'treasurer' | 'keyholder' | 'member'
  targetContribution: integer("target_contribution").notNull().default(0),
  totalContributed: integer("total_contributed").notNull().default(0),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ------------------------------------------------------------------------------
 * 3. VAULT LEDGER TABLE
 * ------------------------------------------------------------------------------
 * Immutable history of member deposits and payouts.
 */
export const vaultLedgerTable = pgTable("vault_ledger", {
  id: text("id").primaryKey(),
  vaultId: text("vault_id").notNull().references(() => vaultsTable.id, { onDelete: "cascade" }),
  memberId: text("member_id").references(() => vaultMembersTable.id, { onDelete: "set null" }),
  memberName: text("member_name").notNull(),
  type: text("type").notNull().default("deposit"), // 'deposit' | 'payout'
  amount: integer("amount").notNull(), // UGX
  currency: text("currency").notNull().default("UGX"),
  paymentMethod: text("payment_method").notNull().default("mtn_momo"), // 'mtn_momo' | 'airtel_money' | 'bank_transfer' | 'cash'
  reference: text("reference"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ------------------------------------------------------------------------------
 * 4. VAULT PAYOUT PROPOSALS TABLE (DESTINATION BALLOTS)
 * ------------------------------------------------------------------------------
 * Explicit payout destination proposals voted on by group members.
 * Captures recipientName, destinationType, bankName, accountNumber, amount, and requiredVotes.
 */
export const vaultPayoutProposalsTable = pgTable("vault_payout_proposals", {
  id: text("id").primaryKey(),
  vaultId: text("vault_id").notNull().references(() => vaultsTable.id, { onDelete: "cascade" }),
  proposerMemberId: text("proposer_member_id").notNull(),
  proposerName: text("proposer_name").notNull(),
  title: text("title").notNull(), // e.g. "Payment for Land Surveying", "School Fees Transfer"
  amount: integer("amount").notNull(), // UGX
  currency: text("currency").notNull().default("UGX"),
  destinationType: text("destination_type").notNull().default("momo_number"), // 'vendor_bank' | 'momo_number' | 'split_equally_to_members'
  recipientName: text("recipient_name").notNull(),
  bankName: text("bank_name"), // e.g. "Stanbic Bank", "Centenary Bank", "Absa"
  accountNumber: text("account_number"),
  phone: text("phone"), // MoMo number
  status: text("status").notNull().default("voting_active"), // 'voting_active' | 'approved' | 'rejected' | 'disbursed'
  requiredVotes: integer("required_votes").notNull().default(2),
  yesVotesCount: integer("yes_votes_count").notNull().default(0),
  noVotesCount: integer("no_votes_count").notNull().default(0),
  disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
  ...timestamps,
});

/**
 * ------------------------------------------------------------------------------
 * 5. VAULT MEMBER VOTES TABLE
 * ------------------------------------------------------------------------------
 * Individual votes cast on proposals by members (1 vote per member enforced).
 */
export const vaultMemberVotesTable = pgTable("vault_member_votes", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id").notNull().references(() => vaultPayoutProposalsTable.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  vote: text("vote").notNull(), // 'yes' | 'no'
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ------------------------------------------------------------------------------
 * Legacy Withdrawal Tables (Maintained for DB consistency)
 * ------------------------------------------------------------------------------
 */
export const vaultWithdrawalsTable = pgTable("vault_withdrawals", {
  id: text("id").primaryKey(),
  vaultId: text("vault_id").notNull().references(() => vaultsTable.id, { onDelete: "cascade" }),
  requestedByMemberId: text("requested_by_member_id").notNull(),
  requestedByName: text("requested_by_name").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("UGX"),
  reason: text("reason").notNull(),
  destinationType: text("destination_type").notNull().default("mobile_money"),
  destinationPhone: text("destination_phone"),
  destinationBankName: text("destination_bank_name"),
  destinationAccountNumber: text("destination_account_number"),
  destinationAccountName: text("destination_account_name"),
  status: text("status").notNull().default("pending_approval"),
  requiredApprovals: integer("required_approvals").notNull().default(2),
  currentApprovals: integer("current_approvals").notNull().default(0),
  rejectionReason: text("rejection_reason"),
  disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
  ...timestamps,
});

export const vaultWithdrawalVotesTable = pgTable("vault_withdrawal_votes", {
  id: text("id").primaryKey(),
  withdrawalId: text("withdrawal_id").notNull().references(() => vaultWithdrawalsTable.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  memberRole: text("member_role").notNull(),
  vote: text("vote").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ------------------------------------------------------------------------------
 * ZOD SCHEMAS & TYPES
 * ------------------------------------------------------------------------------
 */
export const insertVaultSchema = createInsertSchema(vaultsTable).omit({ createdAt: true, updatedAt: true });
export const insertVaultMemberSchema = createInsertSchema(vaultMembersTable).omit({ createdAt: true });
export const insertVaultLedgerSchema = createInsertSchema(vaultLedgerTable).omit({ createdAt: true });
export const insertVaultPayoutProposalSchema = createInsertSchema(vaultPayoutProposalsTable).omit({ createdAt: true, updatedAt: true });
export const insertVaultMemberVoteSchema = createInsertSchema(vaultMemberVotesTable).omit({ createdAt: true });

export type Vault = z.infer<typeof insertVaultSchema>;
export type VaultMember = z.infer<typeof insertVaultMemberSchema>;
export type VaultLedgerEntry = z.infer<typeof insertVaultLedgerSchema>;
export type VaultPayoutProposal = z.infer<typeof insertVaultPayoutProposalSchema>;
export type VaultMemberVote = z.infer<typeof insertVaultMemberVoteSchema>;
