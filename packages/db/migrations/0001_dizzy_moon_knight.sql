CREATE TABLE "fx_quote_financial_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"bucket" text NOT NULL,
	"currency_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"source" text NOT NULL,
	"settlement_mode" text NOT NULL,
	"memo" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fx_quote_financial_lines" ADD CONSTRAINT "fx_quote_financial_lines_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_financial_lines" ADD CONSTRAINT "fx_quote_financial_lines_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_financial_lines_quote_idx_uq" ON "fx_quote_financial_lines" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_financial_lines_quote_id_idx" ON "fx_quote_financial_lines" USING btree ("quote_id");