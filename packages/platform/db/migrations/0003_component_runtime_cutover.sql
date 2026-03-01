CREATE TABLE IF NOT EXISTS "platform_component_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "component_id" text NOT NULL,
  "scope_type" text NOT NULL,
  "scope_id" text NOT NULL,
  "state" text NOT NULL,
  "reason" text NOT NULL,
  "retry_after_sec" integer DEFAULT 300 NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "changed_by" text NOT NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_component_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "component_id" text NOT NULL,
  "scope_type" text NOT NULL,
  "scope_id" text NOT NULL,
  "previous_state" text,
  "new_state" text NOT NULL,
  "reason" text NOT NULL,
  "retry_after_sec" integer DEFAULT 300 NOT NULL,
  "changed_by" text NOT NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_id" text,
  "meta" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_component_runtime_meta" (
  "id" integer PRIMARY KEY NOT NULL,
  "state_epoch" bigint DEFAULT 1 NOT NULL,
  "manifest_checksum" text NOT NULL,
  "manifest_seen_version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_component_states_scope_uq" ON "platform_component_states" USING btree ("component_id","scope_type","scope_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_component_states_component_idx" ON "platform_component_states" USING btree ("component_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_component_states_scope_idx" ON "platform_component_states" USING btree ("scope_type","scope_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_component_events_component_changed_idx" ON "platform_component_events" USING btree ("component_id","changed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_component_events_scope_changed_idx" ON "platform_component_events" USING btree ("scope_type","scope_id","changed_at");
--> statement-breakpoint

INSERT INTO "platform_component_states" (
  "id",
  "component_id",
  "scope_type",
  "scope_id",
  "state",
  "reason",
  "retry_after_sec",
  "version",
  "changed_by",
  "changed_at",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  CASE WHEN "module_id" = 'system-modules' THEN 'system-components' ELSE "module_id" END,
  "scope_type",
  "scope_id",
  "state",
  "reason",
  "retry_after_sec",
  "version",
  "changed_by",
  "changed_at",
  "created_at",
  "updated_at"
FROM "platform_module_states"
ON CONFLICT ("component_id","scope_type","scope_id") DO NOTHING;
--> statement-breakpoint

INSERT INTO "platform_component_events" (
  "id",
  "component_id",
  "scope_type",
  "scope_id",
  "previous_state",
  "new_state",
  "reason",
  "retry_after_sec",
  "changed_by",
  "changed_at",
  "request_id",
  "meta"
)
SELECT
  "id",
  CASE WHEN "module_id" = 'system-modules' THEN 'system-components' ELSE "module_id" END,
  "scope_type",
  "scope_id",
  "previous_state",
  "new_state",
  "reason",
  "retry_after_sec",
  "changed_by",
  "changed_at",
  "request_id",
  "meta"
FROM "platform_module_events"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "platform_component_runtime_meta" (
  "id",
  "state_epoch",
  "manifest_checksum",
  "manifest_seen_version",
  "updated_at"
)
SELECT
  "id",
  "state_epoch",
  "manifest_checksum",
  "manifest_seen_version",
  "updated_at"
FROM "platform_module_runtime_meta"
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

ALTER TABLE "payment_attempts" ADD COLUMN IF NOT EXISTS "claim_token" text;
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN IF NOT EXISTS "claim_until" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_attempts_poll_claim_lease_idx" ON "payment_attempts" USING btree ("status","claim_until","updated_at") WHERE "payment_attempts"."status" in ('submitted','pending');
--> statement-breakpoint

ALTER TABLE "connector_cursors" ADD COLUMN IF NOT EXISTS "claim_token" text;
--> statement-breakpoint
ALTER TABLE "connector_cursors" ADD COLUMN IF NOT EXISTS "claim_until" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connector_cursors_claim_idx" ON "connector_cursors" USING btree ("claim_until","updated_at");
