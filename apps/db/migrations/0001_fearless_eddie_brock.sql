DO $$
BEGIN
  CREATE TYPE "counterparty_relationship_kind" AS ENUM ('customer_owned', 'external');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "counterparties" ADD COLUMN "relationship_kind" "counterparty_relationship_kind" DEFAULT 'external' NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_applications" ADD COLUMN "counterparty_id" uuid;--> statement-breakpoint
ALTER TABLE "ops_deals" ADD COLUMN "counterparty_id" uuid;--> statement-breakpoint
ALTER TABLE "ops_applications" ADD CONSTRAINT "ops_applications_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_deals" ADD CONSTRAINT "ops_deals_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "counterparties" AS cp
SET
  "customer_id" = c."customer_id",
  "relationship_kind" = CASE
    WHEN c."customer_id" IS NULL THEN 'external'::"counterparty_relationship_kind"
    ELSE 'customer_owned'::"counterparty_relationship_kind"
  END,
  "short_name" = COALESCE(NULLIF(c."org_name", ''), cp."short_name"),
  "full_name" = COALESCE(NULLIF(c."org_name", ''), cp."full_name"),
  "external_id" = COALESCE(NULLIF(c."inn", ''), cp."external_id"),
  "country" = COALESCE(
    cp."country",
    CASE
      WHEN NULLIF(upper(c."bank_country"), '') = ANY(enum_range(NULL::"counterparty_country_code")::text[])
        THEN NULLIF(upper(c."bank_country"), '')::"counterparty_country_code"
      ELSE NULL
    END
  ),
  "kind" = 'legal_entity'::"counterparty_kind",
  "updated_at" = now()
FROM "ops_clients" AS c
WHERE c."is_deleted" = false
  AND c."counterparty_id" = cp."id"
  AND (
    c."customer_id" IS NULL
    OR cp."customer_id" IS NULL
    OR cp."customer_id" = c."customer_id"
  );--> statement-breakpoint
DO $$
DECLARE
  client_row RECORD;
  new_counterparty_id uuid;
BEGIN
  FOR client_row IN
    SELECT c.*
    FROM "ops_clients" AS c
    LEFT JOIN "counterparties" AS cp
      ON cp."id" = c."counterparty_id"
    WHERE c."is_deleted" = false
      AND (
        c."counterparty_id" IS NULL
        OR cp."id" IS NULL
        OR (
          c."customer_id" IS NOT NULL
          AND cp."customer_id" IS NOT NULL
          AND cp."customer_id" <> c."customer_id"
        )
      )
    ORDER BY c."id"
  LOOP
    INSERT INTO "counterparties" (
      "id",
      "external_id",
      "customer_id",
      "relationship_kind",
      "short_name",
      "full_name",
      "country",
      "kind",
      "created_at",
      "updated_at"
    )
    VALUES (
      gen_random_uuid(),
      NULLIF(client_row."inn", ''),
      client_row."customer_id",
      CASE
        WHEN client_row."customer_id" IS NULL
          THEN 'external'::"counterparty_relationship_kind"
        ELSE 'customer_owned'::"counterparty_relationship_kind"
      END,
      COALESCE(NULLIF(client_row."org_name", ''), 'Client ' || client_row."id"::text),
      COALESCE(NULLIF(client_row."org_name", ''), 'Client ' || client_row."id"::text),
      CASE
        WHEN NULLIF(upper(client_row."bank_country"), '') = ANY(enum_range(NULL::"counterparty_country_code")::text[])
          THEN NULLIF(upper(client_row."bank_country"), '')::"counterparty_country_code"
        ELSE NULL
      END,
      'legal_entity'::"counterparty_kind",
      now(),
      now()
    )
    RETURNING "id" INTO new_counterparty_id;

    UPDATE "ops_clients"
    SET "counterparty_id" = new_counterparty_id
    WHERE "id" = client_row."id";
  END LOOP;
END $$;--> statement-breakpoint
UPDATE "ops_applications" AS app
SET "counterparty_id" = c."counterparty_id"
FROM "ops_clients" AS c
WHERE app."client_id" = c."id"
  AND c."counterparty_id" IS NOT NULL
  AND (
    app."counterparty_id" IS NULL
    OR app."counterparty_id" <> c."counterparty_id"
  );--> statement-breakpoint
UPDATE "ops_deals" AS deal
SET "counterparty_id" = COALESCE(app."counterparty_id", c."counterparty_id")
FROM "ops_applications" AS app
JOIN "ops_clients" AS c
  ON c."id" = app."client_id"
WHERE deal."application_id" = app."id"
  AND COALESCE(app."counterparty_id", c."counterparty_id") IS NOT NULL
  AND (
    deal."counterparty_id" IS NULL
    OR deal."counterparty_id" <> COALESCE(app."counterparty_id", c."counterparty_id")
  );
