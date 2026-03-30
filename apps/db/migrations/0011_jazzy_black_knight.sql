CREATE TYPE "public"."deal_approval_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."deal_approval_type" AS ENUM('commercial', 'compliance', 'operations');--> statement-breakpoint
CREATE TYPE "public"."deal_leg_kind" AS ENUM('payment', 'currency_exchange', 'currency_transit', 'exporter_settlement');--> statement-breakpoint
CREATE TYPE "public"."deal_participant_role" AS ENUM('customer', 'organization', 'counterparty');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'executing', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."deal_type" AS ENUM('payment', 'currency_exchange', 'currency_transit', 'exporter_settlement');--> statement-breakpoint
CREATE TABLE "deal_approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"approval_type" "deal_approval_type" NOT NULL,
	"status" "deal_approval_status" NOT NULL,
	"requested_by" text,
	"decided_by" text,
	"comment" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deal_legs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"kind" "deal_leg_kind" NOT NULL,
	"status" "deal_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"role" "deal_participant_role" NOT NULL,
	"customer_id" uuid,
	"organization_id" uuid,
	"counterparty_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_participants_exactly_one_fk_chk" CHECK ((
        "deal_participants"."customer_id" is not null
        and "deal_participants"."organization_id" is null
        and "deal_participants"."counterparty_id" is null
      ) or (
        "deal_participants"."customer_id" is null
        and "deal_participants"."organization_id" is not null
        and "deal_participants"."counterparty_id" is null
      ) or (
        "deal_participants"."customer_id" is null
        and "deal_participants"."organization_id" is null
        and "deal_participants"."counterparty_id" is not null
      )),
	CONSTRAINT "deal_participants_role_fk_match_chk" CHECK ((
        "deal_participants"."role" = 'customer'
        and "deal_participants"."customer_id" is not null
        and "deal_participants"."organization_id" is null
        and "deal_participants"."counterparty_id" is null
      ) or (
        "deal_participants"."role" = 'organization'
        and "deal_participants"."customer_id" is null
        and "deal_participants"."organization_id" is not null
        and "deal_participants"."counterparty_id" is null
      ) or (
        "deal_participants"."role" = 'counterparty'
        and "deal_participants"."customer_id" is null
        and "deal_participants"."organization_id" is null
        and "deal_participants"."counterparty_id" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "deal_status_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"status" "deal_status" NOT NULL,
	"changed_by" text,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"calculation_id" uuid NOT NULL,
	"type" "deal_type" NOT NULL,
	"status" "deal_status" DEFAULT 'draft' NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_approvals" ADD CONSTRAINT "deal_approvals_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD CONSTRAINT "deal_legs_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_participants" ADD CONSTRAINT "deal_participants_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_participants" ADD CONSTRAINT "deal_participants_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_participants" ADD CONSTRAINT "deal_participants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_participants" ADD CONSTRAINT "deal_participants_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_status_history" ADD CONSTRAINT "deal_status_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_calculation_id_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."calculations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_approvals_deal_requested_idx" ON "deal_approvals" USING btree ("deal_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_legs_deal_idx_uq" ON "deal_legs" USING btree ("deal_id","idx");--> statement-breakpoint
CREATE INDEX "deal_legs_deal_idx" ON "deal_legs" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_participants_deal_role_uq" ON "deal_participants" USING btree ("deal_id","role");--> statement-breakpoint
CREATE INDEX "deal_participants_deal_idx" ON "deal_participants" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_status_history_deal_created_idx" ON "deal_status_history" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE INDEX "deals_customer_idx" ON "deals" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "deals_agreement_idx" ON "deals" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "deals_calculation_idx" ON "deals" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "deals_status_idx" ON "deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deals_type_idx" ON "deals" USING btree ("type");