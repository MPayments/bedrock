CREATE TABLE "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "doc_type" text NOT NULL,
  "doc_no" text NOT NULL,
  "payload_version" integer DEFAULT 1 NOT NULL,
  "payload" jsonb NOT NULL,
  "title" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "submission_status" text NOT NULL,
  "approval_status" text NOT NULL,
  "posting_status" text NOT NULL,
  "lifecycle_status" text NOT NULL,
  "create_idempotency_key" text,
  "amount_minor" bigint,
  "currency" text,
  "memo" text,
  "counterparty_id" uuid,
  "customer_id" uuid,
  "operational_account_id" uuid,
  "search_text" text DEFAULT '' NOT NULL,
  "created_by" text NOT NULL,
  "submitted_by" text,
  "submitted_at" timestamp with time zone,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "rejected_by" text,
  "rejected_at" timestamp with time zone,
  "cancelled_by" text,
  "cancelled_at" timestamp with time zone,
  "posting_started_at" timestamp with time zone,
  "posted_at" timestamp with time zone,
  "posting_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_operations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL,
  "operation_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "from_document_id" uuid NOT NULL,
  "to_document_id" uuid NOT NULL,
  "link_type" text NOT NULL,
  "role" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_operational_account_id_operational_accounts_id_fk" FOREIGN KEY ("operational_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_rejected_by_user_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_from_document_id_documents_id_fk" FOREIGN KEY ("from_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_to_document_id_documents_id_fk" FOREIGN KEY ("to_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "documents_doc_no_uq" ON "documents" USING btree ("doc_no");
--> statement-breakpoint
CREATE UNIQUE INDEX "documents_doc_type_create_idem_uq" ON "documents" USING btree ("doc_type","create_idempotency_key") WHERE "create_idempotency_key" is not null;
--> statement-breakpoint
CREATE INDEX "documents_doc_type_occurred_idx" ON "documents" USING btree ("doc_type","occurred_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "documents_posting_status_occurred_idx" ON "documents" USING btree ("posting_status","occurred_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "documents_approval_status_occurred_idx" ON "documents" USING btree ("approval_status","occurred_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "documents_lifecycle_status_occurred_idx" ON "documents" USING btree ("lifecycle_status","occurred_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "documents_currency_idx" ON "documents" USING btree ("currency");
--> statement-breakpoint
CREATE INDEX "documents_counterparty_idx" ON "documents" USING btree ("counterparty_id");
--> statement-breakpoint
CREATE INDEX "documents_customer_idx" ON "documents" USING btree ("customer_id");
--> statement-breakpoint
CREATE INDEX "documents_operational_account_idx" ON "documents" USING btree ("operational_account_id");
--> statement-breakpoint
CREATE INDEX "documents_payload_gin_idx" ON "documents" USING gin ("payload");
--> statement-breakpoint
CREATE UNIQUE INDEX "document_operations_document_kind_uq" ON "document_operations" USING btree ("document_id","kind");
--> statement-breakpoint
CREATE UNIQUE INDEX "document_operations_operation_uq" ON "document_operations" USING btree ("operation_id");
--> statement-breakpoint
CREATE INDEX "document_operations_document_idx" ON "document_operations" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "document_links_from_type_idx" ON "document_links" USING btree ("from_document_id","link_type");
--> statement-breakpoint
CREATE INDEX "document_links_to_type_idx" ON "document_links" USING btree ("to_document_id","link_type");
--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_unique_idx" ON "document_links" USING btree ("from_document_id","to_document_id","link_type","role");
--> statement-breakpoint
DROP TABLE "transfer_events" CASCADE;
--> statement-breakpoint
DROP TABLE "transfer_orders" CASCADE;
--> statement-breakpoint
DROP TABLE "fee_payment_orders" CASCADE;
--> statement-breakpoint
DROP TABLE "payment_orders" CASCADE;
--> statement-breakpoint
DROP TABLE "settlements" CASCADE;
--> statement-breakpoint
DROP TABLE "reconciliation_exceptions" CASCADE;
--> statement-breakpoint
DROP TYPE "public"."transfer_event_type";
--> statement-breakpoint
DROP TYPE "public"."transfer_kind";
--> statement-breakpoint
DROP TYPE "public"."transfer_settlement_mode";
--> statement-breakpoint
DROP TYPE "public"."transfer_status";
--> statement-breakpoint
DROP TYPE "public"."fee_accounting_treatment";
