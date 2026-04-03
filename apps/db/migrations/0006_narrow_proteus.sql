ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'leg_operation_created' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_prepared' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_submitted' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_settled' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_failed' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_retried' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_voided' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'return_requested' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_returned' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'execution_blocker_resolved' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'deal_closed' BEFORE 'quote_created';--> statement-breakpoint
CREATE TABLE "treasury_instructions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"operation_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"state" text NOT NULL,
	"source_ref" text NOT NULL,
	"provider_ref" text,
	"provider_snapshot" jsonb DEFAULT 'null'::jsonb,
	"submitted_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"return_requested_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "treasury_instructions" ADD CONSTRAINT "treasury_instructions_operation_id_treasury_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."treasury_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_instructions_source_ref_uq" ON "treasury_instructions" USING btree ("source_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_instructions_operation_attempt_uq" ON "treasury_instructions" USING btree ("operation_id","attempt");--> statement-breakpoint
CREATE INDEX "treasury_instructions_operation_idx" ON "treasury_instructions" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "treasury_instructions_state_idx" ON "treasury_instructions" USING btree ("state");