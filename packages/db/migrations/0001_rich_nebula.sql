CREATE TYPE "public"."requisite_kind" AS ENUM('bank', 'exchange', 'blockchain', 'custodian');
--> statement-breakpoint
CREATE TABLE "counterparty_requisites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"counterparty_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"kind" "requisite_kind" NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"beneficiary_name" text,
	"institution_name" text,
	"institution_country" text,
	"account_no" text,
	"corr_account" text,
	"iban" text,
	"bic" text,
	"swift" text,
	"bank_address" text,
	"network" text,
	"asset_code" text,
	"address" text,
	"memo_tag" text,
	"account_ref" text,
	"subaccount_ref" text,
	"contact" text,
	"notes" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_requisite_bindings" (
	"requisite_id" uuid PRIMARY KEY NOT NULL,
	"book_id" uuid NOT NULL,
	"book_account_instance_id" uuid NOT NULL,
	"posting_account_no" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_requisites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"kind" "requisite_kind" NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"beneficiary_name" text,
	"institution_name" text,
	"institution_country" text,
	"account_no" text,
	"corr_account" text,
	"iban" text,
	"bic" text,
	"swift" text,
	"bank_address" text,
	"network" text,
	"asset_code" text,
	"address" text,
	"memo_tag" text,
	"account_ref" text,
	"subaccount_ref" text,
	"contact" text,
	"notes" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counterparty_requisites" ADD CONSTRAINT "counterparty_requisites_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_requisites" ADD CONSTRAINT "counterparty_requisites_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requisite_bindings" ADD CONSTRAINT "organization_requisite_bindings_requisite_id_organization_requisites_id_fk" FOREIGN KEY ("requisite_id") REFERENCES "public"."organization_requisites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requisite_bindings" ADD CONSTRAINT "organization_requisite_bindings_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requisite_bindings" ADD CONSTRAINT "organization_requisite_bindings_book_account_instance_id_book_account_instances_id_fk" FOREIGN KEY ("book_account_instance_id") REFERENCES "public"."book_account_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requisites" ADD CONSTRAINT "organization_requisites_organization_id_counterparties_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requisites" ADD CONSTRAINT "organization_requisites_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "counterparty_requisites_owner_idx" ON "counterparty_requisites" USING btree ("counterparty_id");--> statement-breakpoint
CREATE INDEX "counterparty_requisites_currency_idx" ON "counterparty_requisites" USING btree ("currency_id");--> statement-breakpoint
CREATE INDEX "counterparty_requisites_kind_idx" ON "counterparty_requisites" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "counterparty_requisites_default_owner_uq" ON "counterparty_requisites" USING btree ("counterparty_id","currency_id") WHERE "counterparty_requisites"."is_default" = true and "counterparty_requisites"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "organization_requisite_bindings_book_idx" ON "organization_requisite_bindings" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "organization_requisite_bindings_book_instance_idx" ON "organization_requisite_bindings" USING btree ("book_account_instance_id");--> statement-breakpoint
CREATE INDEX "organization_requisites_owner_idx" ON "organization_requisites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_requisites_currency_idx" ON "organization_requisites" USING btree ("currency_id");--> statement-breakpoint
CREATE INDEX "organization_requisites_kind_idx" ON "organization_requisites" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_requisites_default_owner_uq" ON "organization_requisites" USING btree ("organization_id","currency_id") WHERE "organization_requisites"."is_default" = true and "organization_requisites"."archived_at" is null;
