DROP TABLE IF EXISTS "deal_operational_positions";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."deal_operational_position_kind";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."deal_operational_position_state";--> statement-breakpoint
ALTER TABLE "deal_legs" DROP COLUMN IF EXISTS "state";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."deal_leg_state";--> statement-breakpoint
CREATE TYPE "public"."deal_leg_manual_override" AS ENUM('blocked', 'skipped');--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "manual_override_state" "deal_leg_manual_override";--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "override_reason_code" text;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "override_comment" text;--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE IF NOT EXISTS 'leg_manual_override_set';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE IF NOT EXISTS 'leg_manual_override_cleared';
