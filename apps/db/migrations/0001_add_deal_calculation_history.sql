ALTER TYPE "public"."calculation_line_kind" ADD VALUE IF NOT EXISTS 'fee_revenue';--> statement-breakpoint
ALTER TYPE "public"."calculation_line_kind" ADD VALUE IF NOT EXISTS 'spread_revenue';--> statement-breakpoint
ALTER TYPE "public"."calculation_line_kind" ADD VALUE IF NOT EXISTS 'provider_fee_expense';--> statement-breakpoint
ALTER TYPE "public"."calculation_line_kind" ADD VALUE IF NOT EXISTS 'pass_through';--> statement-breakpoint
ALTER TYPE "public"."calculation_line_kind" ADD VALUE IF NOT EXISTS 'adjustment';--> statement-breakpoint

ALTER TABLE "calculation_snapshots" ADD COLUMN IF NOT EXISTS "quote_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "deal_calculation_links" ADD COLUMN IF NOT EXISTS "source_quote_id" uuid;--> statement-breakpoint

DROP INDEX IF EXISTS "calculation_lines_snapshot_kind_uq";--> statement-breakpoint
