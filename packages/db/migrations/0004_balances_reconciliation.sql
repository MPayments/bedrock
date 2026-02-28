CREATE TABLE "balance_positions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "book_id" text NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "currency" text NOT NULL,
  "ledger_balance" bigint DEFAULT 0 NOT NULL,
  "available" bigint DEFAULT 0 NOT NULL,
  "reserved" bigint DEFAULT 0 NOT NULL,
  "pending" bigint DEFAULT 0 NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "balance_positions_subject_uq"
  ON "balance_positions" USING btree ("book_id","subject_type","subject_id","currency");
--> statement-breakpoint
CREATE INDEX "balance_positions_subject_idx"
  ON "balance_positions" USING btree ("book_id","subject_type","subject_id","currency");
--> statement-breakpoint

CREATE TABLE "balance_holds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "book_id" text NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "currency" text NOT NULL,
  "hold_ref" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "state" text DEFAULT 'active' NOT NULL,
  "reason" text,
  "actor_id" text,
  "request_id" text,
  "correlation_id" text,
  "trace_id" text,
  "causation_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "released_at" timestamp with time zone,
  "consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "balance_holds_subject_ref_uq"
  ON "balance_holds" USING btree ("book_id","subject_type","subject_id","currency","hold_ref");
--> statement-breakpoint
CREATE INDEX "balance_holds_state_created_idx"
  ON "balance_holds" USING btree ("state","created_at");
--> statement-breakpoint

CREATE TABLE "balance_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "book_id" text NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "currency" text NOT NULL,
  "event_type" text NOT NULL,
  "hold_ref" text,
  "operation_id" uuid REFERENCES "ledger_operations"("id") ON DELETE set null,
  "delta_ledger_balance" bigint DEFAULT 0 NOT NULL,
  "delta_available" bigint DEFAULT 0 NOT NULL,
  "delta_reserved" bigint DEFAULT 0 NOT NULL,
  "delta_pending" bigint DEFAULT 0 NOT NULL,
  "meta" jsonb,
  "actor_id" text,
  "request_id" text,
  "correlation_id" text,
  "trace_id" text,
  "causation_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "balance_events_subject_created_idx"
  ON "balance_events" USING btree ("book_id","subject_type","subject_id","currency","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "balance_events_operation_uq"
  ON "balance_events" USING btree ("operation_id");
--> statement-breakpoint

CREATE TABLE "reconciliation_external_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "source_record_id" text NOT NULL,
  "raw_payload" jsonb NOT NULL,
  "normalized_payload" jsonb NOT NULL,
  "payload_hash" text NOT NULL,
  "normalization_version" integer NOT NULL,
  "request_id" text,
  "correlation_id" text,
  "trace_id" text,
  "causation_id" text,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "recon_external_records_source_id_uq"
  ON "reconciliation_external_records" USING btree ("source","source_record_id");
--> statement-breakpoint
CREATE INDEX "recon_external_records_source_received_idx"
  ON "reconciliation_external_records" USING btree ("source","received_at");
--> statement-breakpoint

CREATE TABLE "reconciliation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "ruleset_checksum" text NOT NULL,
  "input_query" jsonb NOT NULL,
  "result_summary" jsonb NOT NULL,
  "request_id" text,
  "correlation_id" text,
  "trace_id" text,
  "causation_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "recon_runs_source_created_idx"
  ON "reconciliation_runs" USING btree ("source","created_at");
--> statement-breakpoint

CREATE TABLE "reconciliation_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "reconciliation_runs"("id") ON DELETE cascade,
  "external_record_id" uuid NOT NULL REFERENCES "reconciliation_external_records"("id") ON DELETE cascade,
  "matched_operation_id" uuid REFERENCES "ledger_operations"("id") ON DELETE set null,
  "matched_document_id" uuid REFERENCES "documents"("id") ON DELETE set null,
  "status" text NOT NULL,
  "explanation" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "recon_matches_run_idx"
  ON "reconciliation_matches" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "recon_matches_external_record_idx"
  ON "reconciliation_matches" USING btree ("external_record_id");
--> statement-breakpoint

CREATE TABLE "reconciliation_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "reconciliation_runs"("id") ON DELETE cascade,
  "external_record_id" uuid NOT NULL REFERENCES "reconciliation_external_records"("id") ON DELETE cascade,
  "adjustment_document_id" uuid REFERENCES "documents"("id") ON DELETE set null,
  "reason_code" text NOT NULL,
  "reason_meta" jsonb,
  "state" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "recon_exceptions_run_idx"
  ON "reconciliation_exceptions" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "recon_exceptions_state_created_idx"
  ON "reconciliation_exceptions" USING btree ("state","created_at");
