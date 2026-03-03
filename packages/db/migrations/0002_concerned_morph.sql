CREATE TABLE "accounting_close_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"counterparty_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"revision" integer NOT NULL,
	"state" text NOT NULL,
	"close_document_id" uuid NOT NULL,
	"reopen_document_id" uuid,
	"checksum" text NOT NULL,
	"payload" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_report_line_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"standard" text DEFAULT 'ifrs' NOT NULL,
	"report_kind" text NOT NULL,
	"line_code" text NOT NULL,
	"line_label" text NOT NULL,
	"section" text NOT NULL,
	"account_no" text NOT NULL,
	"sign_multiplier" integer DEFAULT 1 NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounting_close_packages" ADD CONSTRAINT "accounting_close_packages_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_close_packages" ADD CONSTRAINT "accounting_close_packages_close_document_id_documents_id_fk" FOREIGN KEY ("close_document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_close_packages" ADD CONSTRAINT "accounting_close_packages_reopen_document_id_documents_id_fk" FOREIGN KEY ("reopen_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_report_line_mappings" ADD CONSTRAINT "accounting_report_line_mappings_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_close_packages_period_revision_uq" ON "accounting_close_packages" USING btree ("counterparty_id","period_start","revision");--> statement-breakpoint
CREATE INDEX "accounting_close_packages_lookup_idx" ON "accounting_close_packages" USING btree ("counterparty_id","period_start","revision");--> statement-breakpoint
CREATE INDEX "accounting_close_packages_state_idx" ON "accounting_close_packages" USING btree ("state","generated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_report_line_mappings_uq" ON "accounting_report_line_mappings" USING btree ("standard","report_kind","line_code","account_no","effective_from");--> statement-breakpoint
CREATE INDEX "accounting_report_line_mappings_lookup_idx" ON "accounting_report_line_mappings" USING btree ("report_kind","account_no","effective_from","effective_to");
