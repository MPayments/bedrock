ALTER TABLE "deal_legs" ADD COLUMN "route_snapshot_leg_id" text;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "from_currency_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "to_currency_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD CONSTRAINT "deal_legs_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD CONSTRAINT "deal_legs_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_legs_deal_route_leg_idx" ON "deal_legs" USING btree ("deal_id","route_snapshot_leg_id");