CREATE TABLE "calculation_application_links" (
	"calculation_id" uuid PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops_deals" ALTER COLUMN "calculation_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "ops_calculations" ADD COLUMN "calculation_id" uuid;
--> statement-breakpoint
ALTER TABLE "ops_deals" ADD COLUMN "calculation_uuid" uuid;
--> statement-breakpoint
ALTER TABLE "calculation_application_links" ADD CONSTRAINT "calculation_application_links_calculation_id_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."calculations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "calculation_application_links_application_idx" ON "calculation_application_links" USING btree ("application_id");
--> statement-breakpoint
ALTER TABLE "ops_calculations" ADD CONSTRAINT "ops_calculations_calculation_id_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."calculations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops_deals" ADD CONSTRAINT "ops_deals_calculation_uuid_calculations_id_fk" FOREIGN KEY ("calculation_uuid") REFERENCES "public"."calculations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops_calculations" ADD CONSTRAINT "ops_calculations_calculation_id_unique" UNIQUE("calculation_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__phase15_gcd_bigint"(a bigint, b bigint)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
	x bigint := abs(a);
	y bigint := abs(b);
	rest bigint;
BEGIN
	IF x = 0 THEN
		RETURN y;
	END IF;

	IF y = 0 THEN
		RETURN x;
	END IF;

	WHILE y <> 0 LOOP
		rest := mod(x, y);
		x := y;
		y := rest;
	END LOOP;

	RETURN x;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__phase15_parse_timestamptz_strict"(raw text, field_name text)
RETURNS timestamp with time zone
LANGUAGE plpgsql
AS $$
DECLARE
	cleaned text;
BEGIN
	cleaned := btrim(coalesce(raw, ''));
	IF cleaned = '' THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % is empty', field_name;
	END IF;

	RETURN cleaned::timestamp with time zone;
EXCEPTION
	WHEN OTHERS THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % has invalid timestamp value "%"', field_name, raw;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__phase15_parse_decimal_strict"(raw text, field_name text, allow_zero boolean)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
	cleaned text;
	parsed numeric;
BEGIN
	cleaned := replace(btrim(coalesce(raw, '')), ',', '.');
	IF cleaned = '' THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % is empty', field_name;
	END IF;

	IF cleaned !~ '^[0-9]+(\.[0-9]+)?$' THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % has invalid decimal value "%"', field_name, raw;
	END IF;

	parsed := cleaned::numeric;
	IF parsed < 0 THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % must be non-negative, got "%"', field_name, raw;
	END IF;

	IF parsed = 0 AND NOT allow_zero THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % must be positive, got "%"', field_name, raw;
	END IF;

	RETURN parsed;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__phase15_decimal_to_minor_strict"(raw text, precision_value integer, field_name text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
	parsed numeric;
	scaled numeric;
BEGIN
	parsed := public.__phase15_parse_decimal_strict(raw, field_name, true);
	scaled := parsed * power(10::numeric, precision_value);

	IF trunc(scaled) <> scaled THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % exceeds currency precision % with value "%"', field_name, precision_value, raw;
	END IF;

	IF scaled > 9223372036854775807::numeric THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % overflows bigint with value "%"', field_name, raw;
	END IF;

	RETURN scaled::bigint;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__phase15_fee_percent_to_bps_strict"(raw text, field_name text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
	parsed numeric;
	scaled numeric;
BEGIN
	parsed := public.__phase15_parse_decimal_strict(raw, field_name, true);
	scaled := parsed * 100;

	IF trunc(scaled) <> scaled THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % cannot be represented as integer bps from value "%"', field_name, raw;
	END IF;

	IF scaled > 9223372036854775807::numeric THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % overflows bigint bps with value "%"', field_name, raw;
	END IF;

	RETURN scaled::bigint;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__phase15_decimal_to_fraction_strict"(raw text, field_name text)
RETURNS TABLE(rate_num bigint, rate_den bigint)
LANGUAGE plpgsql
AS $$
DECLARE
	cleaned text;
	int_part text;
	frac_part text;
	num_numeric numeric;
	den_numeric numeric;
	divisor bigint;
BEGIN
	cleaned := replace(btrim(coalesce(raw, '')), ',', '.');
	IF cleaned = '' THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % is empty', field_name;
	END IF;

	IF cleaned !~ '^[0-9]+(\.[0-9]+)?$' THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % has invalid decimal value "%"', field_name, raw;
	END IF;

	IF cleaned::numeric <= 0 THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % must be positive, got "%"', field_name, raw;
	END IF;

	IF position('.' in cleaned) > 0 THEN
		int_part := split_part(cleaned, '.', 1);
		frac_part := split_part(cleaned, '.', 2);
		num_numeric := (int_part || frac_part)::numeric;
		den_numeric := power(10::numeric, length(frac_part));
	ELSE
		num_numeric := cleaned::numeric;
		den_numeric := 1;
	END IF;

	IF num_numeric > 9223372036854775807::numeric OR den_numeric > 9223372036854775807::numeric THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % overflows bigint fraction storage with value "%"', field_name, raw;
	END IF;

	divisor := public.__phase15_gcd_bigint(num_numeric::bigint, den_numeric::bigint);

	RETURN QUERY
	SELECT num_numeric::bigint / divisor, den_numeric::bigint / divisor;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__phase15_effective_rate_from_amounts"(from_amount_minor bigint, to_amount_minor bigint, field_name text)
RETURNS TABLE(rate_num bigint, rate_den bigint)
LANGUAGE plpgsql
AS $$
DECLARE
	divisor bigint;
BEGIN
	IF from_amount_minor <= 0 OR to_amount_minor <= 0 THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % requires positive minor amounts, got % -> %', field_name, from_amount_minor, to_amount_minor;
	END IF;

	divisor := public.__phase15_gcd_bigint(to_amount_minor, from_amount_minor);
	RETURN QUERY
	SELECT to_amount_minor / divisor, from_amount_minor / divisor;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__phase15_normalize_rate_source_strict"(raw text, has_fx_quote boolean, field_name text)
RETURNS "public"."calculation_rate_source"
LANGUAGE plpgsql
AS $$
DECLARE
	normalized text;
BEGIN
	IF has_fx_quote THEN
		RETURN 'fx_quote';
	END IF;

	normalized := lower(btrim(coalesce(raw, '')));
	IF normalized = '' THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: % is empty', field_name;
	END IF;

	CASE normalized
		WHEN 'cbru' THEN RETURN 'cbr';
		WHEN 'cbr' THEN RETURN 'cbr';
		WHEN 'investing' THEN RETURN 'investing';
		WHEN 'xe' THEN RETURN 'xe';
		WHEN 'manual' THEN RETURN 'manual';
		WHEN 'fx_quote' THEN
			RAISE EXCEPTION 'Phase 15 calculation migration: % references fx_quote without fx_quote_id', field_name;
		ELSE
			RAISE EXCEPTION 'Phase 15 calculation migration: % has unsupported rate source "%"', field_name, raw;
	END CASE;
END
$$;
--> statement-breakpoint
DO $$
DECLARE
	missing_row record;
BEGIN
	SELECT oc.id, oc.currency_code
	INTO missing_row
	FROM ops_calculations oc
	LEFT JOIN currencies calculation_currency
		ON calculation_currency.code = upper(btrim(oc.currency_code))
	WHERE calculation_currency.id IS NULL
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: ops_calculations.id=% references unknown currency_code "%"', missing_row.id, missing_row.currency_code;
	END IF;

	SELECT oc.id, oc.base_currency_code
	INTO missing_row
	FROM ops_calculations oc
	LEFT JOIN currencies base_currency
		ON base_currency.code = upper(btrim(oc.base_currency_code))
	WHERE base_currency.id IS NULL
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: ops_calculations.id=% references unknown base_currency_code "%"', missing_row.id, missing_row.base_currency_code;
	END IF;

	SELECT oc.id, oc.additional_expenses_currency_code
	INTO missing_row
	FROM ops_calculations oc
	LEFT JOIN currencies additional_currency
		ON additional_currency.code = upper(btrim(oc.additional_expenses_currency_code))
	WHERE nullif(btrim(coalesce(oc.additional_expenses_currency_code, '')), '') IS NOT NULL
		AND additional_currency.id IS NULL
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: ops_calculations.id=% references unknown additional_expenses_currency_code "%"', missing_row.id, missing_row.additional_expenses_currency_code;
	END IF;
END
$$;
--> statement-breakpoint
CREATE TEMP TABLE "__phase15_calculation_backfill" ON COMMIT DROP AS
WITH parsed AS (
	SELECT
		oc.id AS legacy_id,
		gen_random_uuid() AS calculation_uuid,
		gen_random_uuid() AS snapshot_uuid,
		oc.application_id,
		oc.sent_to_client,
		(oc.status <> 'archived') AS is_active,
		public.__phase15_parse_timestamptz_strict(
			oc.created_at,
			format('ops_calculations.id=%s created_at', oc.id)
		) AS created_at,
		public.__phase15_parse_timestamptz_strict(
			oc.calculation_timestamp,
			format('ops_calculations.id=%s calculation_timestamp', oc.id)
		) AS calculation_timestamp,
		calculation_currency.id AS calculation_currency_id,
		calculation_currency.code AS calculation_currency_code,
		calculation_currency.precision AS calculation_currency_precision,
		base_currency.id AS base_currency_id,
		base_currency.code AS base_currency_code,
		base_currency.precision AS base_currency_precision,
		CASE
			WHEN nullif(btrim(coalesce(oc.additional_expenses_currency_code, '')), '') IS NULL THEN NULL::uuid
			ELSE additional_currency.id
		END AS additional_expenses_currency_id,
		public.__phase15_decimal_to_minor_strict(
			oc.original_amount,
			calculation_currency.precision,
			format('ops_calculations.id=%s original_amount', oc.id)
		) AS original_amount_minor,
		public.__phase15_fee_percent_to_bps_strict(
			oc.fee_percentage,
			format('ops_calculations.id=%s fee_percentage', oc.id)
		) AS fee_bps,
		public.__phase15_decimal_to_minor_strict(
			oc.fee_amount,
			calculation_currency.precision,
			format('ops_calculations.id=%s fee_amount', oc.id)
		) AS fee_amount_minor,
		public.__phase15_decimal_to_minor_strict(
			oc.total_amount,
			calculation_currency.precision,
			format('ops_calculations.id=%s total_amount', oc.id)
		) AS total_amount_minor,
		public.__phase15_decimal_to_minor_strict(
			oc.fee_amount_in_base,
			base_currency.precision,
			format('ops_calculations.id=%s fee_amount_in_base', oc.id)
		) AS fee_amount_in_base_minor,
		public.__phase15_decimal_to_minor_strict(
			oc.total_in_base,
			base_currency.precision,
			format('ops_calculations.id=%s total_in_base', oc.id)
		) AS total_in_base_minor,
		public.__phase15_decimal_to_minor_strict(
			oc.additional_expenses,
			COALESCE(additional_currency.precision, base_currency.precision),
			format('ops_calculations.id=%s additional_expenses', oc.id)
		) AS additional_expenses_amount_minor,
		public.__phase15_decimal_to_minor_strict(
			oc.additional_expenses_in_base,
			base_currency.precision,
			format('ops_calculations.id=%s additional_expenses_in_base', oc.id)
		) AS additional_expenses_in_base_minor,
		public.__phase15_decimal_to_minor_strict(
			oc.total_with_expenses_in_base,
			base_currency.precision,
			format('ops_calculations.id=%s total_with_expenses_in_base', oc.id)
		) AS total_with_expenses_in_base_minor,
		public.__phase15_normalize_rate_source_strict(
			oc.rate_source,
			oc.fx_quote_id IS NOT NULL,
			format('ops_calculations.id=%s rate_source', oc.id)
		) AS rate_source,
		rate_fraction.rate_num,
		rate_fraction.rate_den,
		oc.fx_quote_id
	FROM ops_calculations oc
	INNER JOIN currencies calculation_currency
		ON calculation_currency.code = upper(btrim(oc.currency_code))
	INNER JOIN currencies base_currency
		ON base_currency.code = upper(btrim(oc.base_currency_code))
	LEFT JOIN currencies additional_currency
		ON additional_currency.code = upper(btrim(oc.additional_expenses_currency_code))
	CROSS JOIN LATERAL public.__phase15_decimal_to_fraction_strict(
		oc.rate,
		format('ops_calculations.id=%s rate', oc.id)
	) AS rate_fraction(rate_num, rate_den)
)
SELECT
	parsed.*,
	CASE
		WHEN parsed.additional_expenses_currency_id IS NULL THEN NULL::"public"."calculation_rate_source"
		WHEN parsed.additional_expenses_currency_id = parsed.base_currency_id THEN NULL::"public"."calculation_rate_source"
		WHEN parsed.additional_expenses_amount_minor = 0 THEN NULL::"public"."calculation_rate_source"
		ELSE parsed.rate_source
	END AS additional_expenses_rate_source,
	CASE
		WHEN parsed.additional_expenses_currency_id IS NULL THEN NULL::bigint
		WHEN parsed.additional_expenses_currency_id = parsed.base_currency_id THEN NULL::bigint
		WHEN parsed.additional_expenses_amount_minor = 0 THEN NULL::bigint
		WHEN parsed.additional_expenses_currency_id = parsed.calculation_currency_id THEN parsed.rate_num
		ELSE additional_rate.rate_num
	END AS additional_expenses_rate_num,
	CASE
		WHEN parsed.additional_expenses_currency_id IS NULL THEN NULL::bigint
		WHEN parsed.additional_expenses_currency_id = parsed.base_currency_id THEN NULL::bigint
		WHEN parsed.additional_expenses_amount_minor = 0 THEN NULL::bigint
		WHEN parsed.additional_expenses_currency_id = parsed.calculation_currency_id THEN parsed.rate_den
		ELSE additional_rate.rate_den
	END AS additional_expenses_rate_den
FROM parsed
LEFT JOIN LATERAL public.__phase15_effective_rate_from_amounts(
	parsed.additional_expenses_amount_minor,
	parsed.additional_expenses_in_base_minor,
	format('ops_calculations.id=%s additional_expenses_rate', parsed.legacy_id)
) AS additional_rate(rate_num, rate_den)
	ON parsed.additional_expenses_currency_id IS NOT NULL
	AND parsed.additional_expenses_currency_id <> parsed.base_currency_id
	AND parsed.additional_expenses_currency_id <> parsed.calculation_currency_id
	AND parsed.additional_expenses_amount_minor > 0;
--> statement-breakpoint
DO $$
DECLARE
	invalid_row record;
BEGIN
	SELECT legacy_id, additional_expenses_amount_minor, additional_expenses_in_base_minor
	INTO invalid_row
	FROM __phase15_calculation_backfill
	WHERE additional_expenses_amount_minor = 0
		AND additional_expenses_in_base_minor <> 0
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: ops_calculations.id=% has zero additional_expenses but non-zero additional_expenses_in_base (% <> %)', invalid_row.legacy_id, invalid_row.additional_expenses_amount_minor, invalid_row.additional_expenses_in_base_minor;
	END IF;

	SELECT legacy_id, additional_expenses_amount_minor, additional_expenses_in_base_minor
	INTO invalid_row
	FROM __phase15_calculation_backfill
	WHERE (
			additional_expenses_currency_id IS NULL
			OR additional_expenses_currency_id = base_currency_id
		)
		AND additional_expenses_amount_minor <> additional_expenses_in_base_minor
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: ops_calculations.id=% is base-denominated for additional expenses but amount and in-base differ (% <> %)', invalid_row.legacy_id, invalid_row.additional_expenses_amount_minor, invalid_row.additional_expenses_in_base_minor;
	END IF;

	SELECT legacy_id, fx_quote_id
	INTO invalid_row
	FROM __phase15_calculation_backfill
	WHERE fx_quote_id IS NOT NULL
		AND NOT EXISTS (
			SELECT 1
			FROM fx_quotes
			WHERE fx_quotes.id = __phase15_calculation_backfill.fx_quote_id
		)
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: ops_calculations.id=% references missing fx_quote_id %', invalid_row.legacy_id, invalid_row.fx_quote_id;
	END IF;

	SELECT backfill.legacy_id
	INTO invalid_row
	FROM __phase15_calculation_backfill backfill
	INNER JOIN fx_quotes quote
		ON quote.id = backfill.fx_quote_id
	WHERE backfill.rate_source = 'fx_quote'
		AND (
			quote.from_currency_id <> backfill.calculation_currency_id
			OR quote.to_currency_id <> backfill.base_currency_id
			OR quote.rate_num <> backfill.rate_num
			OR quote.rate_den <> backfill.rate_den
		)
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: ops_calculations.id=% has fx_quote primary rate provenance mismatch', invalid_row.legacy_id;
	END IF;

	SELECT backfill.legacy_id
	INTO invalid_row
	FROM __phase15_calculation_backfill backfill
	INNER JOIN fx_quotes quote
		ON quote.id = backfill.fx_quote_id
	WHERE backfill.additional_expenses_rate_source = 'fx_quote'
		AND (
			backfill.additional_expenses_currency_id IS NULL
			OR quote.from_currency_id <> backfill.additional_expenses_currency_id
			OR quote.to_currency_id <> backfill.base_currency_id
			OR quote.rate_num <> backfill.additional_expenses_rate_num
			OR quote.rate_den <> backfill.additional_expenses_rate_den
		)
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: ops_calculations.id=% has fx_quote additional-expenses provenance mismatch', invalid_row.legacy_id;
	END IF;
END
$$;
--> statement-breakpoint
INSERT INTO "calculations" (
	"id",
	"current_snapshot_id",
	"is_active",
	"created_at",
	"updated_at"
)
SELECT
	"calculation_uuid",
	NULL,
	"is_active",
	"created_at",
	"created_at"
FROM "__phase15_calculation_backfill";
--> statement-breakpoint
INSERT INTO "calculation_snapshots" (
	"id",
	"calculation_id",
	"snapshot_number",
	"calculation_currency_id",
	"original_amount_minor",
	"fee_bps",
	"fee_amount_minor",
	"total_amount_minor",
	"base_currency_id",
	"fee_amount_in_base_minor",
	"total_in_base_minor",
	"additional_expenses_currency_id",
	"additional_expenses_amount_minor",
	"additional_expenses_in_base_minor",
	"total_with_expenses_in_base_minor",
	"rate_source",
	"rate_num",
	"rate_den",
	"additional_expenses_rate_source",
	"additional_expenses_rate_num",
	"additional_expenses_rate_den",
	"calculation_timestamp",
	"fx_quote_id",
	"created_at",
	"updated_at"
)
SELECT
	"snapshot_uuid",
	"calculation_uuid",
	1,
	"calculation_currency_id",
	"original_amount_minor",
	"fee_bps",
	"fee_amount_minor",
	"total_amount_minor",
	"base_currency_id",
	"fee_amount_in_base_minor",
	"total_in_base_minor",
	"additional_expenses_currency_id",
	"additional_expenses_amount_minor",
	"additional_expenses_in_base_minor",
	"total_with_expenses_in_base_minor",
	"rate_source",
	"rate_num",
	"rate_den",
	"additional_expenses_rate_source",
	"additional_expenses_rate_num",
	"additional_expenses_rate_den",
	"calculation_timestamp",
	"fx_quote_id",
	"created_at",
	"created_at"
FROM "__phase15_calculation_backfill";
--> statement-breakpoint
INSERT INTO "calculation_lines" (
	"id",
	"calculation_snapshot_id",
	"idx",
	"kind",
	"currency_id",
	"amount_minor",
	"created_at",
	"updated_at"
)
SELECT
	gen_random_uuid(),
	"calculation_snapshot_id",
	"idx",
	"kind"::"public"."calculation_line_kind",
	"currency_id",
	"amount_minor",
	"created_at",
	"created_at"
FROM (
	SELECT
		"snapshot_uuid" AS "calculation_snapshot_id",
		0 AS "idx",
		'original_amount' AS "kind",
		"calculation_currency_id" AS "currency_id",
		"original_amount_minor" AS "amount_minor",
		"created_at"
	FROM "__phase15_calculation_backfill"
	UNION ALL
	SELECT
		"snapshot_uuid",
		1,
		'fee_amount',
		"calculation_currency_id",
		"fee_amount_minor",
		"created_at"
	FROM "__phase15_calculation_backfill"
	UNION ALL
	SELECT
		"snapshot_uuid",
		2,
		'total_amount',
		"calculation_currency_id",
		"total_amount_minor",
		"created_at"
	FROM "__phase15_calculation_backfill"
	UNION ALL
	SELECT
		"snapshot_uuid",
		3,
		'additional_expenses',
		COALESCE("additional_expenses_currency_id", "base_currency_id"),
		"additional_expenses_amount_minor",
		"created_at"
	FROM "__phase15_calculation_backfill"
	UNION ALL
	SELECT
		"snapshot_uuid",
		4,
		'fee_amount_in_base',
		"base_currency_id",
		"fee_amount_in_base_minor",
		"created_at"
	FROM "__phase15_calculation_backfill"
	UNION ALL
	SELECT
		"snapshot_uuid",
		5,
		'total_in_base',
		"base_currency_id",
		"total_in_base_minor",
		"created_at"
	FROM "__phase15_calculation_backfill"
	UNION ALL
	SELECT
		"snapshot_uuid",
		6,
		'additional_expenses_in_base',
		"base_currency_id",
		"additional_expenses_in_base_minor",
		"created_at"
	FROM "__phase15_calculation_backfill"
	UNION ALL
	SELECT
		"snapshot_uuid",
		7,
		'total_with_expenses_in_base',
		"base_currency_id",
		"total_with_expenses_in_base_minor",
		"created_at"
	FROM "__phase15_calculation_backfill"
) AS "line_rows";
--> statement-breakpoint
INSERT INTO "calculation_application_links" (
	"calculation_id",
	"application_id",
	"created_at",
	"updated_at"
)
SELECT
	"calculation_uuid",
	"application_id",
	"created_at",
	"created_at"
FROM "__phase15_calculation_backfill";
--> statement-breakpoint
UPDATE "calculations" AS "canonical"
SET
	"current_snapshot_id" = "backfill"."snapshot_uuid",
	"updated_at" = "backfill"."created_at"
FROM "__phase15_calculation_backfill" AS "backfill"
WHERE "canonical"."id" = "backfill"."calculation_uuid";
--> statement-breakpoint
UPDATE "ops_calculations" AS "legacy"
SET "calculation_id" = "backfill"."calculation_uuid"
FROM "__phase15_calculation_backfill" AS "backfill"
WHERE "legacy"."id" = "backfill"."legacy_id";
--> statement-breakpoint
UPDATE "ops_deals" AS "deal"
SET "calculation_uuid" = "legacy"."calculation_id"
FROM "ops_calculations" AS "legacy"
WHERE "deal"."calculation_id" = "legacy"."id"
	AND "deal"."calculation_uuid" IS NULL;
--> statement-breakpoint
DO $$
DECLARE
	missing_deal record;
BEGIN
	SELECT deal.id, deal.calculation_id
	INTO missing_deal
	FROM ops_deals deal
	WHERE deal.calculation_id IS NOT NULL
		AND deal.calculation_uuid IS NULL
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 15 calculation migration: ops_deals.id=% could not resolve canonical calculation_uuid from legacy calculation_id %', missing_deal.id, missing_deal.calculation_id;
	END IF;
END
$$;
--> statement-breakpoint
DROP FUNCTION "public"."__phase15_normalize_rate_source_strict"(text, boolean, text);
--> statement-breakpoint
DROP FUNCTION "public"."__phase15_effective_rate_from_amounts"(bigint, bigint, text);
--> statement-breakpoint
DROP FUNCTION "public"."__phase15_decimal_to_fraction_strict"(text, text);
--> statement-breakpoint
DROP FUNCTION "public"."__phase15_fee_percent_to_bps_strict"(text, text);
--> statement-breakpoint
DROP FUNCTION "public"."__phase15_decimal_to_minor_strict"(text, integer, text);
--> statement-breakpoint
DROP FUNCTION "public"."__phase15_parse_decimal_strict"(text, text, boolean);
--> statement-breakpoint
DROP FUNCTION "public"."__phase15_parse_timestamptz_strict"(text, text);
--> statement-breakpoint
DROP FUNCTION "public"."__phase15_gcd_bigint"(bigint, bigint);
