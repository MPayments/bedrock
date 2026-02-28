ALTER TABLE "documents"
ADD COLUMN "module_id" text DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents"
ADD COLUMN "module_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX "documents_submission_status_occurred_idx" ON "documents" USING btree ("submission_status","occurred_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE TABLE "action_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "actor_id" text,
  "request_hash" text NOT NULL,
  "status" text NOT NULL,
  "result_json" jsonb,
  "error_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "action_receipts_scope_key_uq" ON "action_receipts" USING btree ("scope","idempotency_key");
--> statement-breakpoint
CREATE INDEX "action_receipts_scope_created_idx" ON "action_receipts" USING btree ("scope","created_at");
--> statement-breakpoint
CREATE TABLE "document_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "actor_id" text,
  "correlation_id" text,
  "trace_id" text,
  "causation_id" text,
  "reason_code" text,
  "reason_meta" jsonb,
  "before" jsonb,
  "after" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "document_events_document_created_idx" ON "document_events" USING btree ("document_id","created_at");
--> statement-breakpoint
ALTER TABLE "document_links"
ADD CONSTRAINT "document_links_no_self" CHECK ("from_document_id" <> "to_document_id");
--> statement-breakpoint
CREATE TABLE "document_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL,
  "payload" jsonb NOT NULL,
  "payload_version" integer NOT NULL,
  "module_id" text NOT NULL,
  "module_version" integer NOT NULL,
  "pack_checksum" text NOT NULL,
  "posting_plan_checksum" text NOT NULL,
  "journal_intent_checksum" text NOT NULL,
  "posting_plan" jsonb NOT NULL,
  "journal_intent" jsonb NOT NULL,
  "resolved_templates" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_snapshots" ADD CONSTRAINT "document_snapshots_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "document_snapshots_document_uq" ON "document_snapshots" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "document_snapshots_created_idx" ON "document_snapshots" USING btree ("created_at");
