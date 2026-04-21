ALTER TABLE "fx_quotes" ADD COLUMN "pricing_fingerprint" text;--> statement-breakpoint
CREATE INDEX "fx_quotes_deal_fingerprint_idx" ON "fx_quotes" USING btree ("deal_id","pricing_fingerprint");