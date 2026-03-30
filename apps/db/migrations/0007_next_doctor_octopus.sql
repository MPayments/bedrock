CREATE TYPE "public"."agreement_fee_rule_kind" AS ENUM('agent_fee', 'fixed_fee');--> statement-breakpoint
CREATE TYPE "public"."agreement_fee_rule_unit" AS ENUM('bps', 'money');--> statement-breakpoint
CREATE TYPE "public"."agreement_party_role" AS ENUM('customer', 'organization');--> statement-breakpoint
CREATE TABLE "agreement_fee_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agreement_version_id" uuid NOT NULL,
	"kind" "agreement_fee_rule_kind" NOT NULL,
	"unit" "agreement_fee_rule_unit" NOT NULL,
	"value_numeric" numeric(20, 8) NOT NULL,
	"currency_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_fee_rules_unit_currency_chk" CHECK ((
        "agreement_fee_rules"."unit" = 'bps'
        and "agreement_fee_rules"."currency_id" is null
      ) or (
        "agreement_fee_rules"."unit" = 'money'
        and "agreement_fee_rules"."currency_id" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "agreement_parties" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agreement_version_id" uuid NOT NULL,
	"party_role" "agreement_party_role" NOT NULL,
	"customer_id" uuid,
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_parties_exactly_one_fk_chk" CHECK ((
        "agreement_parties"."customer_id" is not null
        and "agreement_parties"."organization_id" is null
      ) or (
        "agreement_parties"."customer_id" is null
        and "agreement_parties"."organization_id" is not null
      )),
	CONSTRAINT "agreement_parties_role_fk_match_chk" CHECK ((
        "agreement_parties"."party_role" = 'customer'
        and "agreement_parties"."customer_id" is not null
        and "agreement_parties"."organization_id" is null
      ) or (
        "agreement_parties"."party_role" = 'organization'
        and "agreement_parties"."organization_id" is not null
        and "agreement_parties"."customer_id" is null
      ))
);
--> statement-breakpoint
CREATE TABLE "agreement_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agreement_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"contract_number" text,
	"contract_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"organization_requisite_id" uuid NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agreement_fee_rules" ADD CONSTRAINT "agreement_fee_rules_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_fee_rules" ADD CONSTRAINT "agreement_fee_rules_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_parties" ADD CONSTRAINT "agreement_parties_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_parties" ADD CONSTRAINT "agreement_parties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_parties" ADD CONSTRAINT "agreement_parties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_organization_requisite_id_requisites_id_fk" FOREIGN KEY ("organization_requisite_id") REFERENCES "public"."requisites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_current_version_id_agreement_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_fee_rules_version_kind_uq" ON "agreement_fee_rules" USING btree ("agreement_version_id","kind");--> statement-breakpoint
CREATE INDEX "agreement_fee_rules_version_idx" ON "agreement_fee_rules" USING btree ("agreement_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_parties_version_role_uq" ON "agreement_parties" USING btree ("agreement_version_id","party_role");--> statement-breakpoint
CREATE INDEX "agreement_parties_version_idx" ON "agreement_parties" USING btree ("agreement_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_versions_agreement_version_uq" ON "agreement_versions" USING btree ("agreement_id","version_number");--> statement-breakpoint
CREATE INDEX "agreement_versions_agreement_idx" ON "agreement_versions" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "agreements_customer_idx" ON "agreements" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "agreements_organization_idx" ON "agreements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agreements_current_version_idx" ON "agreements" USING btree ("current_version_id");