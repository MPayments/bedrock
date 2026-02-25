CREATE TYPE "public"."account_provider_type" AS ENUM('bank', 'exchange', 'blockchain', 'custodian');--> statement-breakpoint
CREATE TABLE "account_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "account_provider_type" NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"contact" text,
	"bic" text,
	"swift" text,
	"country" "counterparty_country_code" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" RENAME TO "accounts";--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT "bank_accounts_counterparty_id_counterparties_id_fk";
--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT "bank_accounts_currency_id_currencies_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_orders" DROP CONSTRAINT "payment_orders_payin_account_id_bank_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_orders" DROP CONSTRAINT "payment_orders_payout_account_id_bank_accounts_id_fk";
--> statement-breakpoint
DROP INDEX "bank_accounts_counterparty_stable_uq";--> statement-breakpoint
DROP INDEX "bank_accounts_counterparty_cur_idx";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "account_provider_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "corr_account" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_providers_name_uq" ON "account_providers" USING btree ("name");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_account_provider_id_account_providers_id_fk" FOREIGN KEY ("account_provider_id") REFERENCES "public"."account_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payin_account_id_accounts_id_fk" FOREIGN KEY ("payin_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payout_account_id_accounts_id_fk" FOREIGN KEY ("payout_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_counterparty_stable_uq" ON "accounts" USING btree ("counterparty_id","stable_key");--> statement-breakpoint
CREATE INDEX "accounts_counterparty_cur_idx" ON "accounts" USING btree ("counterparty_id","currency_id");--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "rail";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "bic_swift";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "bank_name";