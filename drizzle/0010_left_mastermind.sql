ALTER TYPE "public"."transaction_type" ADD VALUE 'reconciliation';--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "last_reconciled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "last_reconciled_balance" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reconciliation_delta" numeric(12, 2);