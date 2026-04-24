CREATE TABLE "payment_step_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_step_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"provider_ref" text,
	"provider_snapshot" jsonb,
	"submitted_at" timestamp with time zone NOT NULL,
	"outcome" text DEFAULT 'pending' NOT NULL,
	"outcome_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"kind" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"deal_id" uuid,
	"deal_leg_idx" integer,
	"deal_leg_role" text,
	"treasury_batch_id" uuid,
	"from_party_id" uuid NOT NULL,
	"from_requisite_id" uuid,
	"to_party_id" uuid NOT NULL,
	"to_requisite_id" uuid,
	"from_currency_id" uuid NOT NULL,
	"to_currency_id" uuid NOT NULL,
	"from_amount_minor" bigint,
	"to_amount_minor" bigint,
	"rate_value" text,
	"rate_locked_side" text,
	"postings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_step_attempts" ADD CONSTRAINT "payment_step_attempts_payment_step_id_payment_steps_id_fk" FOREIGN KEY ("payment_step_id") REFERENCES "public"."payment_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD CONSTRAINT "payment_steps_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD CONSTRAINT "payment_steps_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_step_attempts_step_attempt_uq" ON "payment_step_attempts" USING btree ("payment_step_id","attempt_no");--> statement-breakpoint
CREATE INDEX "payment_step_attempts_step_idx" ON "payment_step_attempts" USING btree ("payment_step_id");--> statement-breakpoint
CREATE INDEX "payment_step_attempts_outcome_idx" ON "payment_step_attempts" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "payment_step_attempts_provider_ref_idx" ON "payment_step_attempts" USING btree ("provider_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_steps_deal_leg_uq" ON "payment_steps" USING btree ("deal_id","deal_leg_idx");--> statement-breakpoint
CREATE INDEX "payment_steps_purpose_idx" ON "payment_steps" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX "payment_steps_kind_idx" ON "payment_steps" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "payment_steps_state_idx" ON "payment_steps" USING btree ("state");--> statement-breakpoint
CREATE INDEX "payment_steps_deal_idx" ON "payment_steps" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "payment_steps_batch_idx" ON "payment_steps" USING btree ("treasury_batch_id");--> statement-breakpoint
CREATE INDEX "payment_steps_scheduled_idx" ON "payment_steps" USING btree ("scheduled_at");
