CREATE TYPE "public"."deal_route_component_basis_type" AS ENUM('deal_source_amount', 'deal_target_amount', 'leg_from_amount', 'leg_to_amount', 'gross_revenue');--> statement-breakpoint
CREATE TYPE "public"."deal_route_component_classification" AS ENUM('revenue', 'expense', 'pass_through', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."deal_route_component_formula_type" AS ENUM('fixed', 'bps', 'per_million', 'manual');--> statement-breakpoint
CREATE TYPE "public"."deal_route_leg_kind" AS ENUM('collection', 'intracompany_transfer', 'intercompany_funding', 'fx_conversion', 'payout', 'return', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."deal_route_party_kind" AS ENUM('customer', 'counterparty', 'organization');--> statement-breakpoint
CREATE TYPE "public"."deal_route_template_participant_binding" AS ENUM('fixed_party', 'deal_customer', 'deal_applicant', 'deal_payer', 'deal_beneficiary');--> statement-breakpoint
CREATE TYPE "public"."deal_route_template_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "deal_routes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_route_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"validation_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_route_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_version_id" uuid NOT NULL,
	"code" text NOT NULL,
	"role" text NOT NULL,
	"party_kind" "deal_route_party_kind" NOT NULL,
	"customer_id" uuid,
	"organization_id" uuid,
	"counterparty_id" uuid,
	"requisite_id" uuid,
	"display_name_snapshot" text,
	"sequence" integer NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_route_participants_exactly_one_fk_chk" CHECK ((
        "deal_route_participants"."customer_id" is not null
        and "deal_route_participants"."organization_id" is null
        and "deal_route_participants"."counterparty_id" is null
      ) or (
        "deal_route_participants"."customer_id" is null
        and "deal_route_participants"."organization_id" is not null
        and "deal_route_participants"."counterparty_id" is null
      ) or (
        "deal_route_participants"."customer_id" is null
        and "deal_route_participants"."organization_id" is null
        and "deal_route_participants"."counterparty_id" is not null
      )),
	CONSTRAINT "deal_route_participants_kind_fk_match_chk" CHECK ((
        "deal_route_participants"."party_kind" = 'customer'
        and "deal_route_participants"."customer_id" is not null
        and "deal_route_participants"."organization_id" is null
        and "deal_route_participants"."counterparty_id" is null
      ) or (
        "deal_route_participants"."party_kind" = 'organization'
        and "deal_route_participants"."organization_id" is not null
        and "deal_route_participants"."customer_id" is null
        and "deal_route_participants"."counterparty_id" is null
      ) or (
        "deal_route_participants"."party_kind" = 'counterparty'
        and "deal_route_participants"."counterparty_id" is not null
        and "deal_route_participants"."customer_id" is null
        and "deal_route_participants"."organization_id" is null
      ))
);
--> statement-breakpoint
CREATE TABLE "deal_route_legs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_version_id" uuid NOT NULL,
	"code" text NOT NULL,
	"idx" integer NOT NULL,
	"kind" "deal_route_leg_kind" NOT NULL,
	"from_participant_id" uuid NOT NULL,
	"to_participant_id" uuid NOT NULL,
	"from_currency_id" uuid NOT NULL,
	"to_currency_id" uuid NOT NULL,
	"expected_from_amount_minor" bigint,
	"expected_to_amount_minor" bigint,
	"expected_rate_num" bigint,
	"expected_rate_den" bigint,
	"settlement_model" text NOT NULL,
	"execution_counterparty_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_route_cost_components" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_version_id" uuid NOT NULL,
	"leg_id" uuid,
	"code" text NOT NULL,
	"family" text NOT NULL,
	"classification" "deal_route_component_classification" NOT NULL,
	"formula_type" "deal_route_component_formula_type" NOT NULL,
	"basis_type" "deal_route_component_basis_type" NOT NULL,
	"currency_id" uuid NOT NULL,
	"fixed_amount_minor" bigint,
	"bps" text,
	"per_million" text,
	"manual_amount_minor" bigint,
	"rounding_mode" text NOT NULL,
	"included_in_client_rate" boolean DEFAULT false NOT NULL,
	"sequence" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_template_cost_components" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_template_id" uuid NOT NULL,
	"leg_id" uuid,
	"code" text NOT NULL,
	"family" text NOT NULL,
	"classification" "deal_route_component_classification" NOT NULL,
	"formula_type" "deal_route_component_formula_type" NOT NULL,
	"basis_type" "deal_route_component_basis_type" NOT NULL,
	"currency_id" uuid NOT NULL,
	"fixed_amount_minor" bigint,
	"bps" text,
	"per_million" text,
	"manual_amount_minor" bigint,
	"rounding_mode" text NOT NULL,
	"included_in_client_rate" boolean DEFAULT false NOT NULL,
	"sequence" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_template_legs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_template_id" uuid NOT NULL,
	"code" text NOT NULL,
	"idx" integer NOT NULL,
	"kind" "deal_route_leg_kind" NOT NULL,
	"from_participant_id" uuid NOT NULL,
	"to_participant_id" uuid NOT NULL,
	"from_currency_id" uuid NOT NULL,
	"to_currency_id" uuid NOT NULL,
	"expected_from_amount_minor" bigint,
	"expected_to_amount_minor" bigint,
	"expected_rate_num" bigint,
	"expected_rate_den" bigint,
	"settlement_model" text NOT NULL,
	"execution_counterparty_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_template_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_template_id" uuid NOT NULL,
	"code" text NOT NULL,
	"role" text NOT NULL,
	"binding_kind" "deal_route_template_participant_binding" NOT NULL,
	"party_kind" "deal_route_party_kind" NOT NULL,
	"customer_id" uuid,
	"organization_id" uuid,
	"counterparty_id" uuid,
	"requisite_id" uuid,
	"display_name_template" text,
	"sequence" integer NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_template_participants_fixed_party_fk_chk" CHECK ((
        "route_template_participants"."binding_kind" <> 'fixed_party'
        and "route_template_participants"."customer_id" is null
        and "route_template_participants"."organization_id" is null
        and "route_template_participants"."counterparty_id" is null
      ) or (
        "route_template_participants"."binding_kind" = 'fixed_party'
        and (
          ("route_template_participants"."customer_id" is not null and "route_template_participants"."organization_id" is null and "route_template_participants"."counterparty_id" is null)
          or ("route_template_participants"."customer_id" is null and "route_template_participants"."organization_id" is not null and "route_template_participants"."counterparty_id" is null)
          or ("route_template_participants"."customer_id" is null and "route_template_participants"."organization_id" is null and "route_template_participants"."counterparty_id" is not null)
        )
      )),
	CONSTRAINT "route_template_participants_fixed_party_kind_fk_match_chk" CHECK ((
        "route_template_participants"."binding_kind" <> 'fixed_party'
      ) or (
        "route_template_participants"."party_kind" = 'customer'
        and "route_template_participants"."customer_id" is not null
        and "route_template_participants"."organization_id" is null
        and "route_template_participants"."counterparty_id" is null
      ) or (
        "route_template_participants"."party_kind" = 'organization'
        and "route_template_participants"."organization_id" is not null
        and "route_template_participants"."customer_id" is null
        and "route_template_participants"."counterparty_id" is null
      ) or (
        "route_template_participants"."party_kind" = 'counterparty'
        and "route_template_participants"."counterparty_id" is not null
        and "route_template_participants"."customer_id" is null
        and "route_template_participants"."organization_id" is null
      )),
	CONSTRAINT "route_template_participants_binding_kind_party_kind_chk" CHECK ((
        "route_template_participants"."binding_kind" = 'fixed_party'
      ) or (
        "route_template_participants"."binding_kind" = 'deal_customer'
        and "route_template_participants"."party_kind" = 'customer'
      ) or (
        "route_template_participants"."binding_kind" in ('deal_applicant', 'deal_payer', 'deal_beneficiary')
        and "route_template_participants"."party_kind" = 'counterparty'
      ))
);
--> statement-breakpoint
CREATE TABLE "route_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"deal_type" "deal_type" NOT NULL,
	"description" text,
	"status" "deal_route_template_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_routes" ADD CONSTRAINT "deal_routes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_versions" ADD CONSTRAINT "deal_route_versions_route_id_deal_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."deal_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_versions" ADD CONSTRAINT "deal_route_versions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_participants" ADD CONSTRAINT "deal_route_participants_route_version_id_deal_route_versions_id_fk" FOREIGN KEY ("route_version_id") REFERENCES "public"."deal_route_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_participants" ADD CONSTRAINT "deal_route_participants_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_participants" ADD CONSTRAINT "deal_route_participants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_participants" ADD CONSTRAINT "deal_route_participants_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_participants" ADD CONSTRAINT "deal_route_participants_requisite_id_requisites_id_fk" FOREIGN KEY ("requisite_id") REFERENCES "public"."requisites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_legs" ADD CONSTRAINT "deal_route_legs_route_version_id_deal_route_versions_id_fk" FOREIGN KEY ("route_version_id") REFERENCES "public"."deal_route_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_legs" ADD CONSTRAINT "deal_route_legs_from_participant_id_deal_route_participants_id_fk" FOREIGN KEY ("from_participant_id") REFERENCES "public"."deal_route_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_legs" ADD CONSTRAINT "deal_route_legs_to_participant_id_deal_route_participants_id_fk" FOREIGN KEY ("to_participant_id") REFERENCES "public"."deal_route_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_legs" ADD CONSTRAINT "deal_route_legs_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_legs" ADD CONSTRAINT "deal_route_legs_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_legs" ADD CONSTRAINT "deal_route_legs_execution_counterparty_id_counterparties_id_fk" FOREIGN KEY ("execution_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_cost_components" ADD CONSTRAINT "deal_route_cost_components_route_version_id_deal_route_versions_id_fk" FOREIGN KEY ("route_version_id") REFERENCES "public"."deal_route_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_cost_components" ADD CONSTRAINT "deal_route_cost_components_leg_id_deal_route_legs_id_fk" FOREIGN KEY ("leg_id") REFERENCES "public"."deal_route_legs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_route_cost_components" ADD CONSTRAINT "deal_route_cost_components_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_cost_components" ADD CONSTRAINT "route_template_cost_components_route_template_id_route_templates_id_fk" FOREIGN KEY ("route_template_id") REFERENCES "public"."route_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_cost_components" ADD CONSTRAINT "route_template_cost_components_leg_id_route_template_legs_id_fk" FOREIGN KEY ("leg_id") REFERENCES "public"."route_template_legs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_cost_components" ADD CONSTRAINT "route_template_cost_components_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_route_template_id_route_templates_id_fk" FOREIGN KEY ("route_template_id") REFERENCES "public"."route_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_from_participant_id_route_template_participants_id_fk" FOREIGN KEY ("from_participant_id") REFERENCES "public"."route_template_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_to_participant_id_route_template_participants_id_fk" FOREIGN KEY ("to_participant_id") REFERENCES "public"."route_template_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_execution_counterparty_id_counterparties_id_fk" FOREIGN KEY ("execution_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_participants" ADD CONSTRAINT "route_template_participants_route_template_id_route_templates_id_fk" FOREIGN KEY ("route_template_id") REFERENCES "public"."route_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_participants" ADD CONSTRAINT "route_template_participants_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_participants" ADD CONSTRAINT "route_template_participants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_participants" ADD CONSTRAINT "route_template_participants_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_participants" ADD CONSTRAINT "route_template_participants_requisite_id_requisites_id_fk" FOREIGN KEY ("requisite_id") REFERENCES "public"."requisites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_routes_deal_uq" ON "deal_routes" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_routes_current_version_idx" ON "deal_routes" USING btree ("current_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_route_versions_route_version_uq" ON "deal_route_versions" USING btree ("route_id","version");--> statement-breakpoint
CREATE INDEX "deal_route_versions_deal_idx" ON "deal_route_versions" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_route_participants_version_code_uq" ON "deal_route_participants" USING btree ("route_version_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_route_participants_version_sequence_uq" ON "deal_route_participants" USING btree ("route_version_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_route_legs_version_code_uq" ON "deal_route_legs" USING btree ("route_version_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_route_legs_version_idx_uq" ON "deal_route_legs" USING btree ("route_version_id","idx");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_route_cost_components_version_code_uq" ON "deal_route_cost_components" USING btree ("route_version_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_route_cost_components_version_sequence_uq" ON "deal_route_cost_components" USING btree ("route_version_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_cost_components_template_code_uq" ON "route_template_cost_components" USING btree ("route_template_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_cost_components_template_sequence_uq" ON "route_template_cost_components" USING btree ("route_template_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_legs_template_code_uq" ON "route_template_legs" USING btree ("route_template_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_legs_template_idx_uq" ON "route_template_legs" USING btree ("route_template_id","idx");--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_participants_template_code_uq" ON "route_template_participants" USING btree ("route_template_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_participants_template_sequence_uq" ON "route_template_participants" USING btree ("route_template_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "route_templates_code_uq" ON "route_templates" USING btree ("code");--> statement-breakpoint
CREATE INDEX "route_templates_status_idx" ON "route_templates" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "route_templates_deal_type_idx" ON "route_templates" USING btree ("deal_type");
