ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_outcome_recorded' BEFORE 'return_requested';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_artifact_attached' BEFORE 'return_requested';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'deal_leg_amended' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'deal_route_template_swapped' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'acceptance_revoked_by_operator' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'reconciliation_exception_resolved';--> statement-breakpoint
CREATE TABLE "treasury_instruction_artifacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"instruction_id" uuid NOT NULL,
	"file_asset_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"memo" text,
	"uploaded_by_user_id" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_quote_acceptances" ADD COLUMN "revocation_reason" text;--> statement-breakpoint
ALTER TABLE "treasury_instruction_artifacts" ADD CONSTRAINT "treasury_instruction_artifacts_instruction_id_treasury_instructions_id_fk" FOREIGN KEY ("instruction_id") REFERENCES "public"."treasury_instructions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treasury_instruction_artifacts_instruction_uploaded_idx" ON "treasury_instruction_artifacts" USING btree ("instruction_id","uploaded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "treasury_instruction_artifacts_instruction_purpose_idx" ON "treasury_instruction_artifacts" USING btree ("instruction_id","purpose");