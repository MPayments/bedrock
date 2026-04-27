CREATE TABLE "quote_executions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_ref" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"origin" jsonb NOT NULL,
	"deal_id" uuid,
	"treasury_order_id" uuid,
	"quote_id" uuid NOT NULL,
	"quote_leg_idx" integer,
	"quote_snapshot" jsonb,
	"from_currency_id" uuid NOT NULL,
	"to_currency_id" uuid NOT NULL,
	"from_amount_minor" bigint NOT NULL,
	"to_amount_minor" bigint NOT NULL,
	"rate_num" bigint NOT NULL,
	"rate_den" bigint NOT NULL,
	"provider_ref" text,
	"provider_snapshot" jsonb,
	"posting_document_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "treasury_order_steps" ADD COLUMN "quote_execution_id" uuid;--> statement-breakpoint
ALTER TABLE "quote_executions" ADD CONSTRAINT "quote_executions_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_executions" ADD CONSTRAINT "quote_executions_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_executions_source_ref_uq" ON "quote_executions" USING btree ("source_ref");--> statement-breakpoint
CREATE INDEX "quote_executions_state_idx" ON "quote_executions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "quote_executions_deal_idx" ON "quote_executions" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "quote_executions_order_idx" ON "quote_executions" USING btree ("treasury_order_id");--> statement-breakpoint
CREATE INDEX "quote_executions_quote_idx" ON "quote_executions" USING btree ("quote_id");--> statement-breakpoint
ALTER TABLE "treasury_order_steps" ADD CONSTRAINT "treasury_order_steps_quote_execution_id_quote_executions_id_fk" FOREIGN KEY ("quote_execution_id") REFERENCES "public"."quote_executions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treasury_order_steps_quote_execution_idx" ON "treasury_order_steps" USING btree ("quote_execution_id");
