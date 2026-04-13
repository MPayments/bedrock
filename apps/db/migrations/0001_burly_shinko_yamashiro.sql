ALTER TABLE "calculation_snapshots" ADD COLUMN "agreement_version_id" uuid;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "agreement_fee_bps" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "agreement_fee_amount_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "fixed_fee_amount_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "fixed_fee_currency_id" uuid;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "quote_markup_bps" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "quote_markup_amount_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "reference_rate_source" "calculation_rate_source";--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "reference_rate_num" bigint;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "reference_rate_den" bigint;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "reference_rate_as_of" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "pricing_provenance" jsonb;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "commercial_terms" jsonb;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_fixed_fee_currency_id_currencies_id_fk" FOREIGN KEY ("fixed_fee_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_fixed_fee_currency_shape_chk" CHECK ((
        "calculation_snapshots"."fixed_fee_amount_minor" = 0
        and "calculation_snapshots"."fixed_fee_currency_id" is null
      ) or (
        "calculation_snapshots"."fixed_fee_amount_minor" > 0
        and "calculation_snapshots"."fixed_fee_currency_id" is not null
      ));--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_reference_rate_shape_chk" CHECK ((
        "calculation_snapshots"."reference_rate_source" is null
        and "calculation_snapshots"."reference_rate_num" is null
        and "calculation_snapshots"."reference_rate_den" is null
        and "calculation_snapshots"."reference_rate_as_of" is null
      ) or (
        "calculation_snapshots"."reference_rate_source" is not null
        and "calculation_snapshots"."reference_rate_num" is not null
        and "calculation_snapshots"."reference_rate_den" is not null
        and "calculation_snapshots"."reference_rate_as_of" is not null
        and "calculation_snapshots"."reference_rate_num" > 0
        and "calculation_snapshots"."reference_rate_den" > 0
      ));