CREATE TABLE "payment_step_returns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_step_id" uuid NOT NULL,
	"amount_minor" bigint,
	"currency_id" uuid,
	"provider_ref" text,
	"reason" text,
	"returned_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_order_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"kind" text NOT NULL,
	"source_ref" text NOT NULL,
	"payment_step_id" uuid,
	"quote_id" uuid,
	"from_party_id" uuid NOT NULL,
	"from_requisite_id" uuid,
	"to_party_id" uuid NOT NULL,
	"to_requisite_id" uuid,
	"from_currency_id" uuid NOT NULL,
	"to_currency_id" uuid NOT NULL,
	"from_amount_minor" bigint,
	"to_amount_minor" bigint,
	"rate" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"description" text,
	"activated_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "payment_steps_deal_leg_uq";--> statement-breakpoint
ALTER TABLE "payment_steps" ADD COLUMN "source_ref" text NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD COLUMN "origin" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD COLUMN "treasury_order_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD COLUMN "quote_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD COLUMN "planned_route" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD COLUMN "current_route" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD COLUMN "amendments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_step_returns" ADD CONSTRAINT "payment_step_returns_payment_step_id_payment_steps_id_fk" FOREIGN KEY ("payment_step_id") REFERENCES "public"."payment_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_step_returns" ADD CONSTRAINT "payment_step_returns_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_order_steps" ADD CONSTRAINT "treasury_order_steps_order_id_treasury_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."treasury_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_order_steps" ADD CONSTRAINT "treasury_order_steps_payment_step_id_payment_steps_id_fk" FOREIGN KEY ("payment_step_id") REFERENCES "public"."payment_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_order_steps" ADD CONSTRAINT "treasury_order_steps_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_order_steps" ADD CONSTRAINT "treasury_order_steps_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_step_returns_step_idx" ON "payment_step_returns" USING btree ("payment_step_id");--> statement-breakpoint
CREATE INDEX "payment_step_returns_returned_at_idx" ON "payment_step_returns" USING btree ("returned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_order_steps_order_sequence_uq" ON "treasury_order_steps" USING btree ("order_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_order_steps_source_ref_uq" ON "treasury_order_steps" USING btree ("source_ref");--> statement-breakpoint
CREATE INDEX "treasury_order_steps_order_idx" ON "treasury_order_steps" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "treasury_order_steps_payment_step_idx" ON "treasury_order_steps" USING btree ("payment_step_id");--> statement-breakpoint
CREATE INDEX "treasury_orders_type_idx" ON "treasury_orders" USING btree ("type");--> statement-breakpoint
CREATE INDEX "treasury_orders_state_idx" ON "treasury_orders" USING btree ("state");--> statement-breakpoint
CREATE INDEX "treasury_orders_created_at_idx" ON "treasury_orders" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_steps_source_ref_uq" ON "payment_steps" USING btree ("source_ref");--> statement-breakpoint
CREATE INDEX "payment_steps_order_idx" ON "payment_steps" USING btree ("treasury_order_id");