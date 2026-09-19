CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"opening_balance" numeric(18, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category_id" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"period" text DEFAULT 'monthly' NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_contributions" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"contributor_name" text NOT NULL,
	"contributor_phone" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"payment_method" text DEFAULT 'mtn_momo' NOT NULL,
	"reference" text,
	"message" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'general' NOT NULL,
	"target_amount" integer NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"deadline" date,
	"account_id" text,
	"recipient_phone" text,
	"recipient_name" text,
	"image_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"icon" text DEFAULT 'circle' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"debt_id" text NOT NULL,
	"amount" integer NOT NULL,
	"account_id" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"person_or_entity" text NOT NULL,
	"type" text NOT NULL,
	"principal_amount" integer NOT NULL,
	"remaining_amount" integer NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"target_amount" numeric(18, 2) NOT NULL,
	"current_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"target_date" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_locked" boolean DEFAULT true NOT NULL,
	"cooldown_hours" integer DEFAULT 24 NOT NULL,
	"pending_withdrawal_amount" numeric(18, 2),
	"pending_withdrawal_at" timestamp with time zone,
	"accountability_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text,
	"account_id" text NOT NULL,
	"amount" integer NOT NULL,
	"direction" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"country" text NOT NULL,
	"preferred_currency" text DEFAULT 'UGX' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"category_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"fee_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"description" text NOT NULL,
	"notes" text,
	"transaction_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"base_currency" text DEFAULT 'UGX' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vault_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"vault_id" text NOT NULL,
	"member_id" text,
	"member_name" text NOT NULL,
	"type" text DEFAULT 'deposit' NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"payment_method" text DEFAULT 'mtn_momo' NOT NULL,
	"reference" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_member_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"vote" text NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_members" (
	"id" text PRIMARY KEY NOT NULL,
	"vault_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"target_contribution" integer DEFAULT 0 NOT NULL,
	"total_contributed" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_payout_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"vault_id" text NOT NULL,
	"proposer_member_id" text NOT NULL,
	"proposer_name" text NOT NULL,
	"title" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"destination_type" text DEFAULT 'momo_number' NOT NULL,
	"recipient_name" text NOT NULL,
	"bank_name" text,
	"account_number" text,
	"phone" text,
	"status" text DEFAULT 'voting_active' NOT NULL,
	"required_votes" integer DEFAULT 2 NOT NULL,
	"yes_votes_count" integer DEFAULT 0 NOT NULL,
	"no_votes_count" integer DEFAULT 0 NOT NULL,
	"disbursed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_withdrawal_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"withdrawal_id" text NOT NULL,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"member_role" text NOT NULL,
	"vote" text NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_withdrawals" (
	"id" text PRIMARY KEY NOT NULL,
	"vault_id" text NOT NULL,
	"requested_by_member_id" text NOT NULL,
	"requested_by_name" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"reason" text NOT NULL,
	"destination_type" text DEFAULT 'mobile_money' NOT NULL,
	"destination_phone" text,
	"destination_bank_name" text,
	"destination_account_number" text,
	"destination_account_name" text,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"required_approvals" integer DEFAULT 2 NOT NULL,
	"current_approvals" integer DEFAULT 0 NOT NULL,
	"rejection_reason" text,
	"disbursed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_amount" integer NOT NULL,
	"current_amount" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"lock_type" text DEFAULT 'time_locked' NOT NULL,
	"unlock_date" text,
	"min_signatures_required" integer DEFAULT 2 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vault_ledger" ADD CONSTRAINT "vault_ledger_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_ledger" ADD CONSTRAINT "vault_ledger_member_id_vault_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."vault_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_member_votes" ADD CONSTRAINT "vault_member_votes_proposal_id_vault_payout_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."vault_payout_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_members" ADD CONSTRAINT "vault_members_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_payout_proposals" ADD CONSTRAINT "vault_payout_proposals_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_withdrawal_votes" ADD CONSTRAINT "vault_withdrawal_votes_withdrawal_id_vault_withdrawals_id_fk" FOREIGN KEY ("withdrawal_id") REFERENCES "public"."vault_withdrawals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_withdrawals" ADD CONSTRAINT "vault_withdrawals_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;