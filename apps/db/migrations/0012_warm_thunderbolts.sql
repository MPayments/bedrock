ALTER TABLE "ops_applications" ADD COLUMN "deal_id" uuid;
--> statement-breakpoint
ALTER TABLE "ops_deals" ALTER COLUMN "application_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "ops_deals" ADD COLUMN "deal_id" uuid;
--> statement-breakpoint
ALTER TABLE "ops_todos" ADD COLUMN "deal_id" uuid;
--> statement-breakpoint
ALTER TABLE "ops_applications" ADD CONSTRAINT "ops_applications_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops_deals" ADD CONSTRAINT "ops_deals_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops_todos" ADD CONSTRAINT "ops_todos_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops_applications" ADD CONSTRAINT "ops_applications_deal_id_unique" UNIQUE("deal_id");
--> statement-breakpoint
ALTER TABLE "ops_deals" ADD CONSTRAINT "ops_deals_deal_id_unique" UNIQUE("deal_id");
--> statement-breakpoint
DO $$
DECLARE
  duplicate_row record;
  invalid_row record;
BEGIN
  SELECT od.application_id, count(*)::int AS deal_count
  INTO duplicate_row
  FROM ops_deals od
  WHERE od.application_id IS NOT NULL
  GROUP BY od.application_id
  HAVING count(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Phase 17 migration: ops_application.id=% has % linked ops_deals rows', duplicate_row.application_id, duplicate_row.deal_count;
  END IF;

  SELECT oa.id, oa.client_id
  INTO invalid_row
  FROM ops_applications oa
  LEFT JOIN ops_clients oc ON oc.id = oa.client_id
  WHERE oc.id IS NULL OR oc.customer_id IS NULL
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Phase 17 migration: ops_application.id=% cannot resolve customer from client_id=%', invalid_row.id, invalid_row.client_id;
  END IF;

  SELECT oa.id, oc.customer_id
  INTO invalid_row
  FROM ops_applications oa
  JOIN ops_clients oc ON oc.id = oa.client_id
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS active_agreement_count
    FROM agreements ag
    WHERE ag.customer_id = oc.customer_id
      AND ag.is_active = true
  ) agreement_counts ON true
  WHERE agreement_counts.active_agreement_count <> 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Phase 17 migration: ops_application.id=% customer_id=% must resolve exactly one active agreement', invalid_row.id, invalid_row.customer_id;
  END IF;

  SELECT oa.id, oa.requested_currency
  INTO invalid_row
  FROM ops_applications oa
  WHERE (nullif(btrim(coalesce(oa.requested_amount, '')), '') IS NULL) <> (nullif(btrim(coalesce(oa.requested_currency, '')), '') IS NULL)
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Phase 17 migration: ops_application.id=% must provide requested_amount and requested_currency together', invalid_row.id;
  END IF;

  SELECT oa.id, oa.requested_currency
  INTO invalid_row
  FROM ops_applications oa
  LEFT JOIN currencies requested_currency
    ON requested_currency.code = upper(btrim(oa.requested_currency))
  WHERE nullif(btrim(coalesce(oa.requested_currency, '')), '') IS NOT NULL
    AND requested_currency.id IS NULL
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Phase 17 migration: ops_application.id=% references unknown requested_currency "%"', invalid_row.id, invalid_row.requested_currency;
  END IF;

  SELECT oc.id, oc.application_id
  INTO invalid_row
  FROM ops_calculations oc
  WHERE oc.application_id IS NOT NULL
    AND oc.calculation_id IS NULL
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Phase 17 migration: ops_calculations.id=% for application_id=% is missing canonical calculation_id bridge', invalid_row.id, invalid_row.application_id;
  END IF;
END
$$;
--> statement-breakpoint
CREATE TEMP TABLE "__phase17_application_backfill" ON COMMIT DROP AS
WITH resolved AS (
  SELECT
    oa.id AS application_id,
    gen_random_uuid() AS deal_id,
    gen_random_uuid() AS leg_id,
    gen_random_uuid() AS customer_participant_id,
    gen_random_uuid() AS organization_participant_id,
    CASE
      WHEN COALESCE(od.counterparty_id, oa.counterparty_id) IS NOT NULL
        THEN gen_random_uuid()
      ELSE NULL::uuid
    END AS counterparty_participant_id,
    gen_random_uuid() AS status_history_id,
    oc.customer_id,
    ag.id AS agreement_id,
    ag.organization_id,
    COALESCE(od.counterparty_id, oa.counterparty_id) AS counterparty_id,
    latest_calculation.calculation_id AS calculation_id,
    oa.agent_id,
    nullif(btrim(coalesce(oa.reason, '')), '') AS reason,
    nullif(btrim(coalesce(oa.comment, '')), '') AS intake_comment,
    nullif(btrim(coalesce(od.comment, '')), '') AS comment,
    CASE
      WHEN nullif(btrim(coalesce(oa.requested_amount, '')), '') IS NULL
        THEN NULL::bigint
      ELSE public.__phase15_decimal_to_minor_strict(
        oa.requested_amount,
        requested_currency.precision,
        format('ops_applications.id=%s requested_amount', oa.id)
      )
    END AS requested_amount_minor,
    requested_currency.id AS requested_currency_id,
    CASE
      WHEN od.id IS NULL THEN
        CASE oa.status
          WHEN 'forming' THEN 'draft'::"public"."deal_status"
          WHEN 'created' THEN 'submitted'::"public"."deal_status"
          WHEN 'rejected' THEN 'rejected'::"public"."deal_status"
          WHEN 'finished' THEN 'done'::"public"."deal_status"
        END
      ELSE (od.status::text)::"public"."deal_status"
    END AS deal_status,
    public.__phase15_parse_timestamptz_strict(
      oa.created_at::text,
      format('ops_applications.id=%s created_at', oa.id)
    ) AS created_at,
    GREATEST(
      public.__phase15_parse_timestamptz_strict(
        oa.updated_at::text,
        format('ops_applications.id=%s updated_at', oa.id)
      ),
      COALESCE(
        public.__phase15_parse_timestamptz_strict(
          od.updated_at,
          format('ops_deals.application_id=%s updated_at', oa.id)
        ),
        public.__phase15_parse_timestamptz_strict(
          oa.updated_at::text,
          format('ops_applications.id=%s updated_at', oa.id)
        )
      )
    ) AS updated_at
  FROM ops_applications oa
  JOIN ops_clients oc
    ON oc.id = oa.client_id
  JOIN agreements ag
    ON ag.customer_id = oc.customer_id
   AND ag.is_active = true
  LEFT JOIN ops_deals od
    ON od.application_id = oa.id
  LEFT JOIN currencies requested_currency
    ON requested_currency.code = upper(btrim(oa.requested_currency))
  LEFT JOIN LATERAL (
    SELECT cal.calculation_id
    FROM calculation_application_links cal
    JOIN calculations c
      ON c.id = cal.calculation_id
    WHERE cal.application_id = oa.id
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT 1
  ) latest_calculation ON true
)
SELECT *
FROM resolved;
--> statement-breakpoint
INSERT INTO "deals" (
  "id",
  "customer_id",
  "agreement_id",
  "calculation_id",
  "type",
  "status",
  "agent_id",
  "reason",
  "intake_comment",
  "comment",
  "requested_amount_minor",
  "requested_currency_id",
  "created_at",
  "updated_at"
)
SELECT
  backfill.deal_id,
  backfill.customer_id,
  backfill.agreement_id,
  backfill.calculation_id,
  'payment'::"public"."deal_type",
  backfill.deal_status,
  backfill.agent_id,
  backfill.reason,
  backfill.intake_comment,
  backfill.comment,
  backfill.requested_amount_minor,
  backfill.requested_currency_id,
  backfill.created_at,
  backfill.updated_at
FROM "__phase17_application_backfill" backfill;
--> statement-breakpoint
INSERT INTO "deal_legs" (
  "id",
  "deal_id",
  "idx",
  "kind",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  backfill.leg_id,
  backfill.deal_id,
  1,
  'payment'::"public"."deal_leg_kind",
  backfill.deal_status,
  backfill.created_at,
  backfill.updated_at
FROM "__phase17_application_backfill" backfill;
--> statement-breakpoint
INSERT INTO "deal_participants" (
  "id",
  "deal_id",
  "role",
  "customer_id",
  "organization_id",
  "counterparty_id",
  "created_at",
  "updated_at"
)
SELECT
  backfill.customer_participant_id,
  backfill.deal_id,
  'customer'::"public"."deal_participant_role",
  backfill.customer_id,
  NULL,
  NULL,
  backfill.created_at,
  backfill.updated_at
FROM "__phase17_application_backfill" backfill
UNION ALL
SELECT
  backfill.organization_participant_id,
  backfill.deal_id,
  'organization'::"public"."deal_participant_role",
  NULL,
  backfill.organization_id,
  NULL,
  backfill.created_at,
  backfill.updated_at
FROM "__phase17_application_backfill" backfill
UNION ALL
SELECT
  backfill.counterparty_participant_id,
  backfill.deal_id,
  'counterparty'::"public"."deal_participant_role",
  NULL,
  NULL,
  backfill.counterparty_id,
  backfill.created_at,
  backfill.updated_at
FROM "__phase17_application_backfill" backfill
WHERE backfill.counterparty_participant_id IS NOT NULL;
--> statement-breakpoint
INSERT INTO "deal_status_history" (
  "id",
  "deal_id",
  "status",
  "changed_by",
  "comment",
  "created_at"
)
SELECT
  backfill.status_history_id,
  backfill.deal_id,
  backfill.deal_status,
  backfill.agent_id,
  COALESCE(backfill.comment, backfill.intake_comment),
  backfill.updated_at
FROM "__phase17_application_backfill" backfill;
--> statement-breakpoint
INSERT INTO "deal_calculation_links" (
  "id",
  "deal_id",
  "calculation_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  backfill.deal_id,
  cal.calculation_id,
  backfill.created_at,
  backfill.updated_at
FROM "__phase17_application_backfill" backfill
JOIN calculation_application_links cal
  ON cal.application_id = backfill.application_id
ON CONFLICT ("deal_id","calculation_id") DO NOTHING;
--> statement-breakpoint
UPDATE "ops_applications" oa
SET "deal_id" = backfill.deal_id
FROM "__phase17_application_backfill" backfill
WHERE oa.id = backfill.application_id;
--> statement-breakpoint
UPDATE "ops_deals" od
SET "deal_id" = backfill.deal_id
FROM "__phase17_application_backfill" backfill
WHERE od.application_id = backfill.application_id;
--> statement-breakpoint
UPDATE "ops_todos" ot
SET "deal_id" = backfill.deal_id
FROM "__phase17_application_backfill" backfill
WHERE ot.application_id = backfill.application_id;
