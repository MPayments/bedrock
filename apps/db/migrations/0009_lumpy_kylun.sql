CREATE TYPE "public"."calculation_line_kind" AS ENUM('original_amount', 'fee_amount', 'total_amount', 'additional_expenses', 'fee_amount_in_base', 'total_in_base', 'additional_expenses_in_base', 'total_with_expenses_in_base');--> statement-breakpoint
CREATE TYPE "public"."calculation_rate_source" AS ENUM('cbr', 'investing', 'xe', 'manual', 'fx_quote');--> statement-breakpoint
CREATE TABLE "calculation_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"calculation_snapshot_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"kind" "calculation_line_kind" NOT NULL,
	"currency_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calculation_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"calculation_id" uuid NOT NULL,
	"snapshot_number" integer NOT NULL,
	"calculation_currency_id" uuid NOT NULL,
	"original_amount_minor" bigint NOT NULL,
	"fee_bps" bigint NOT NULL,
	"fee_amount_minor" bigint NOT NULL,
	"total_amount_minor" bigint NOT NULL,
	"base_currency_id" uuid NOT NULL,
	"fee_amount_in_base_minor" bigint NOT NULL,
	"total_in_base_minor" bigint NOT NULL,
	"additional_expenses_currency_id" uuid,
	"additional_expenses_amount_minor" bigint NOT NULL,
	"additional_expenses_in_base_minor" bigint NOT NULL,
	"total_with_expenses_in_base_minor" bigint NOT NULL,
	"rate_source" "calculation_rate_source" NOT NULL,
	"rate_num" bigint NOT NULL,
	"rate_den" bigint NOT NULL,
	"additional_expenses_rate_source" "calculation_rate_source",
	"additional_expenses_rate_num" bigint,
	"additional_expenses_rate_den" bigint,
	"calculation_timestamp" timestamp with time zone NOT NULL,
	"fx_quote_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calculation_snapshots_rate_positive_chk" CHECK ("calculation_snapshots"."rate_num" > 0 and "calculation_snapshots"."rate_den" > 0),
	CONSTRAINT "calculation_snapshots_additional_rate_shape_chk" CHECK ((
        "calculation_snapshots"."additional_expenses_rate_source" is null
        and "calculation_snapshots"."additional_expenses_rate_num" is null
        and "calculation_snapshots"."additional_expenses_rate_den" is null
      ) or (
        "calculation_snapshots"."additional_expenses_rate_source" is not null
        and "calculation_snapshots"."additional_expenses_rate_num" is not null
        and "calculation_snapshots"."additional_expenses_rate_den" is not null
        and "calculation_snapshots"."additional_expenses_rate_num" > 0
        and "calculation_snapshots"."additional_expenses_rate_den" > 0
      )),
	CONSTRAINT "calculation_snapshots_additional_rate_currency_chk" CHECK ((
        (
          "calculation_snapshots"."additional_expenses_currency_id" is null
          or "calculation_snapshots"."additional_expenses_currency_id" = "calculation_snapshots"."base_currency_id"
        )
        and "calculation_snapshots"."additional_expenses_rate_source" is null
        and "calculation_snapshots"."additional_expenses_rate_num" is null
        and "calculation_snapshots"."additional_expenses_rate_den" is null
      ) or (
        "calculation_snapshots"."additional_expenses_currency_id" is not null
        and "calculation_snapshots"."additional_expenses_currency_id" <> "calculation_snapshots"."base_currency_id"
      )),
	CONSTRAINT "calculation_snapshots_fx_quote_consistency_chk" CHECK ((
        "calculation_snapshots"."rate_source" = 'fx_quote'
        and "calculation_snapshots"."fx_quote_id" is not null
      ) or (
        "calculation_snapshots"."rate_source" <> 'fx_quote'
        and "calculation_snapshots"."fx_quote_id" is null
      ))
);
--> statement-breakpoint
CREATE TABLE "calculations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"current_snapshot_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD CONSTRAINT "calculation_lines_calculation_snapshot_id_calculation_snapshots_id_fk" FOREIGN KEY ("calculation_snapshot_id") REFERENCES "public"."calculation_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD CONSTRAINT "calculation_lines_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_calculation_id_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."calculations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_calculation_currency_id_currencies_id_fk" FOREIGN KEY ("calculation_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_base_currency_id_currencies_id_fk" FOREIGN KEY ("base_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_additional_expenses_currency_id_currencies_id_fk" FOREIGN KEY ("additional_expenses_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_fx_quote_id_fx_quotes_id_fk" FOREIGN KEY ("fx_quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_current_snapshot_id_calculation_snapshots_id_fk" FOREIGN KEY ("current_snapshot_id") REFERENCES "public"."calculation_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calculation_lines_snapshot_idx_uq" ON "calculation_lines" USING btree ("calculation_snapshot_id","idx");--> statement-breakpoint
CREATE UNIQUE INDEX "calculation_lines_snapshot_kind_uq" ON "calculation_lines" USING btree ("calculation_snapshot_id","kind");--> statement-breakpoint
CREATE INDEX "calculation_lines_snapshot_idx" ON "calculation_lines" USING btree ("calculation_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calculation_snapshots_calc_snapshot_uq" ON "calculation_snapshots" USING btree ("calculation_id","snapshot_number");--> statement-breakpoint
CREATE INDEX "calculation_snapshots_calc_idx" ON "calculation_snapshots" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "calculation_snapshots_fx_quote_idx" ON "calculation_snapshots" USING btree ("fx_quote_id");--> statement-breakpoint
CREATE INDEX "calculations_current_snapshot_idx" ON "calculations" USING btree ("current_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calculations_current_snapshot_uq" ON "calculations" USING btree ("current_snapshot_id") WHERE "calculations"."current_snapshot_id" is not null;