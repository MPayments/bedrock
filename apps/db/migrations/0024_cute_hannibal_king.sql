ALTER TABLE "deal_leg_operation_links" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "treasury_instruction_artifacts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "treasury_instructions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "treasury_operations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "deal_leg_operation_links" CASCADE;--> statement-breakpoint
DROP TABLE "treasury_instruction_artifacts" CASCADE;--> statement-breakpoint
DROP TABLE "treasury_instructions" CASCADE;--> statement-breakpoint
DROP TABLE "treasury_operations" CASCADE;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" DROP CONSTRAINT IF EXISTS "reconciliation_matches_matched_treasury_operation_id_treasury_operations_id_fk";
--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_matched_treasury_operation_id_payment_steps_id_fk" FOREIGN KEY ("matched_treasury_operation_id") REFERENCES "public"."payment_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."deal_leg_operation_kind";