CREATE TABLE "accounting_period_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"counterparty_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'closed' NOT NULL,
	"locked_by_document_id" uuid,
	"close_reason" text,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"reopened_by" text,
	"reopen_reason" text,
	"reopened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounting_period_locks" ADD CONSTRAINT "accounting_period_locks_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_period_locks" ADD CONSTRAINT "accounting_period_locks_locked_by_document_id_documents_id_fk" FOREIGN KEY ("locked_by_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_period_locks_counterparty_period_uq" ON "accounting_period_locks" USING btree ("counterparty_id","period_start");--> statement-breakpoint
CREATE INDEX "accounting_period_locks_state_period_idx" ON "accounting_period_locks" USING btree ("state","period_start" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "accounting_period_locks_counterparty_state_idx" ON "accounting_period_locks" USING btree ("counterparty_id","state");