CREATE TYPE "public"."target_cadence" AS ENUM('weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('refill_up_to', 'set_aside_monthly', 'by_date');--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "target_type" "target_type";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "target_cadence" "target_cadence";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "target_date" date;--> statement-breakpoint
-- Existing categories already had a flat target_amount with no concept of
-- type; default them to "refill_up_to" (balance vs. target, no monthly
-- reset) so their target keeps behaving the same way it always has instead
-- of silently losing its progress display.
UPDATE "categories" SET "target_type" = 'refill_up_to' WHERE "target_amount" IS NOT NULL AND "target_type" IS NULL;