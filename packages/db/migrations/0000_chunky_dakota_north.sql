CREATE TYPE "public"."ledger_account_kind" AS ENUM('customer', 'internal', 'general_ledger');--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"ref_key" text PRIMARY KEY NOT NULL,
	"kind" "ledger_account_kind" NOT NULL,
	"currency" text NOT NULL,
	"customer_id" text,
	"internal_name" text,
	"coa_code" text,
	"tb_account_id" numeric(39,0) NOT NULL,
	"tb_ledger" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_tb_account_id_uq" ON "ledger_accounts" USING btree ("tb_account_id");