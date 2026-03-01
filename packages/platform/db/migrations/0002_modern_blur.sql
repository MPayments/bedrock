CREATE TABLE "platform_module_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" text NOT NULL,
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
CREATE TABLE "platform_module_runtime_meta" (
	"id" integer PRIMARY KEY NOT NULL,
	"state_epoch" bigint DEFAULT 1 NOT NULL,
	"manifest_checksum" text NOT NULL,
	"manifest_seen_version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_module_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" text NOT NULL,
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
CREATE INDEX "platform_module_events_module_changed_idx" ON "platform_module_events" USING btree ("module_id","changed_at");--> statement-breakpoint
CREATE INDEX "platform_module_events_scope_changed_idx" ON "platform_module_events" USING btree ("scope_type","scope_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_module_states_scope_uq" ON "platform_module_states" USING btree ("module_id","scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "platform_module_states_module_idx" ON "platform_module_states" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "platform_module_states_scope_idx" ON "platform_module_states" USING btree ("scope_type","scope_id");