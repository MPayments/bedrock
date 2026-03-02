CREATE TABLE "connector_cursors" (
	"provider_code" text NOT NULL,
	"cursor_key" text NOT NULL,
	"cursor_value" text,
	"last_fetched_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connector_cursors_pk" PRIMARY KEY("provider_code","cursor_key")
);
--> statement-breakpoint
CREATE TABLE "connector_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_code" text NOT NULL,
	"event_type" text NOT NULL,
	"webhook_idempotency_key" text NOT NULL,
	"signature_valid" boolean DEFAULT false NOT NULL,
	"parse_status" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"parsed_payload" jsonb,
	"intent_id" uuid,
	"attempt_id" uuid,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "connector_health" (
	"provider_code" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"score" integer DEFAULT 100 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"direction" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"corridor" text,
	"provider_constraint" text,
	"status" text NOT NULL,
	"current_attempt_no" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_code" text NOT NULL,
	"intent_id" uuid,
	"attempt_id" uuid,
	"ref_kind" text NOT NULL,
	"ref_value" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"provider_code" text NOT NULL,
	"provider_route" text,
	"status" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"external_attempt_ref" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"error" text,
	"next_retry_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orchestration_scope_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text DEFAULT 'book' NOT NULL,
	"scope_id" text NOT NULL,
	"routing_rule_id" uuid NOT NULL,
	"override_config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_corridors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_code" text NOT NULL,
	"corridor" text NOT NULL,
	"direction" text NOT NULL,
	"currency" text NOT NULL,
	"country_from" text,
	"country_to" text,
	"supports_webhooks" boolean DEFAULT true NOT NULL,
	"polling_required" boolean DEFAULT false NOT NULL,
	"sla_score" integer DEFAULT 50 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_fee_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_code" text NOT NULL,
	"corridor" text NOT NULL,
	"currency" text NOT NULL,
	"fixed_fee_minor" bigint DEFAULT 0 NOT NULL,
	"bps" integer DEFAULT 0 NOT NULL,
	"fx_markup_bps" integer DEFAULT 0 NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_code" text NOT NULL,
	"corridor" text NOT NULL,
	"currency" text NOT NULL,
	"min_amount_minor" bigint NOT NULL,
	"max_amount_minor" bigint NOT NULL,
	"daily_volume_minor" bigint,
	"daily_count" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"priority" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"direction" text,
	"corridor" text,
	"currency" text,
	"country_from" text,
	"country_to" text,
	"amount_min_minor" bigint,
	"amount_max_minor" bigint,
	"risk_min" integer,
	"risk_max" integer,
	"preferred_providers" jsonb,
	"degradation_order" jsonb,
	"weight_cost" integer DEFAULT 40 NOT NULL,
	"weight_fx" integer DEFAULT 20 NOT NULL,
	"weight_sla" integer DEFAULT 20 NOT NULL,
	"weight_health" integer DEFAULT 20 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_events" ADD CONSTRAINT "connector_events_intent_id_connector_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."connector_payment_intents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_events" ADD CONSTRAINT "connector_events_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_payment_intents" ADD CONSTRAINT "connector_payment_intents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_references" ADD CONSTRAINT "connector_references_intent_id_connector_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."connector_payment_intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_references" ADD CONSTRAINT "connector_references_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_intent_id_connector_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."connector_payment_intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orchestration_scope_overrides" ADD CONSTRAINT "orchestration_scope_overrides_routing_rule_id_routing_rules_id_fk" FOREIGN KEY ("routing_rule_id") REFERENCES "public"."routing_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connector_events_provider_key_uq" ON "connector_events" USING btree ("provider_code","webhook_idempotency_key");--> statement-breakpoint
CREATE INDEX "connector_events_provider_received_idx" ON "connector_events" USING btree ("provider_code","received_at");--> statement-breakpoint
CREATE INDEX "connector_events_intent_received_idx" ON "connector_events" USING btree ("intent_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connector_payment_intents_document_uq" ON "connector_payment_intents" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "connector_payment_intents_status_idx" ON "connector_payment_intents" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connector_references_provider_kind_value_uq" ON "connector_references" USING btree ("provider_code","ref_kind","ref_value");--> statement-breakpoint
CREATE INDEX "connector_references_intent_idx" ON "connector_references" USING btree ("intent_id","created_at");--> statement-breakpoint
CREATE INDEX "connector_references_attempt_idx" ON "connector_references" USING btree ("attempt_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_intent_no_uq" ON "payment_attempts" USING btree ("intent_id","attempt_no");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_idempotency_uq" ON "payment_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_attempts_dispatch_claim_idx" ON "payment_attempts" USING btree ("status","next_retry_at","created_at") WHERE "payment_attempts"."status" in ('queued','failed_retryable');--> statement-breakpoint
CREATE INDEX "payment_attempts_poll_claim_idx" ON "payment_attempts" USING btree ("status","updated_at") WHERE "payment_attempts"."status" in ('submitted','pending');--> statement-breakpoint
CREATE INDEX "payment_attempts_provider_status_idx" ON "payment_attempts" USING btree ("provider_code","status");--> statement-breakpoint
CREATE UNIQUE INDEX "orchestration_scope_overrides_scope_rule_uq" ON "orchestration_scope_overrides" USING btree ("scope_type","scope_id","routing_rule_id");--> statement-breakpoint
CREATE INDEX "orchestration_scope_overrides_scope_idx" ON "orchestration_scope_overrides" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_corridors_provider_corridor_direction_currency_uq" ON "provider_corridors" USING btree ("provider_code","corridor","direction","currency");--> statement-breakpoint
CREATE INDEX "provider_corridors_enabled_idx" ON "provider_corridors" USING btree ("enabled","provider_code","corridor","direction","currency");--> statement-breakpoint
CREATE INDEX "provider_fee_schedules_lookup_idx" ON "provider_fee_schedules" USING btree ("provider_code","corridor","currency","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_limits_provider_corridor_currency_uq" ON "provider_limits" USING btree ("provider_code","corridor","currency");--> statement-breakpoint
CREATE INDEX "provider_limits_enabled_idx" ON "provider_limits" USING btree ("enabled","provider_code","corridor");--> statement-breakpoint
CREATE UNIQUE INDEX "routing_rules_name_uq" ON "routing_rules" USING btree ("name");--> statement-breakpoint
CREATE INDEX "routing_rules_enabled_priority_idx" ON "routing_rules" USING btree ("enabled","priority");--> statement-breakpoint
CREATE INDEX "routing_rules_match_idx" ON "routing_rules" USING btree ("enabled","direction","corridor","currency");