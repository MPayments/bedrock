CREATE TABLE "payment_route_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source_customer_id" uuid NOT NULL,
	"destination_entity_kind" text NOT NULL,
	"destination_entity_id" uuid NOT NULL,
	"currency_in_id" uuid NOT NULL,
	"currency_out_id" uuid NOT NULL,
	"hop_count" integer DEFAULT 0 NOT NULL,
	"draft" jsonb NOT NULL,
	"visual" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_calculation" jsonb,
	"snapshot_policy" text DEFAULT 'clone_on_attach' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "payment_route_templates_status_idx" ON "payment_route_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_route_templates_name_idx" ON "payment_route_templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "payment_route_templates_updated_idx" ON "payment_route_templates" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "payment_route_templates_source_customer_idx" ON "payment_route_templates" USING btree ("source_customer_id");