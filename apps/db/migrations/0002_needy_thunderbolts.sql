ALTER TABLE "organizations" ALTER COLUMN "country" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "name_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "org_type" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "org_type_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "country_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "inn" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tax_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "kpp" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "ogrn" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "oktmo" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "okpo" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "director_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "director_name_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "director_position" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "director_position_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "director_basis" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "director_basis_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "signature_key" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "seal_key" text;--> statement-breakpoint
UPDATE "organizations" AS org
SET
  "kind" = 'legal_entity'::"party_kind",
  "is_active" = legacy."is_active",
  "name_i18n" = COALESCE(legacy."name_i18n", org."name_i18n"),
  "org_type" = COALESCE(NULLIF(legacy."org_type", ''), org."org_type"),
  "org_type_i18n" = COALESCE(legacy."org_type_i18n", org."org_type_i18n"),
  "country" = COALESCE(NULLIF(legacy."country", ''), org."country"),
  "country_i18n" = COALESCE(legacy."country_i18n", org."country_i18n"),
  "city" = COALESCE(NULLIF(legacy."city", ''), org."city"),
  "city_i18n" = COALESCE(legacy."city_i18n", org."city_i18n"),
  "address" = COALESCE(NULLIF(legacy."address", ''), org."address"),
  "address_i18n" = COALESCE(legacy."address_i18n", org."address_i18n"),
  "inn" = COALESCE(NULLIF(legacy."inn", ''), org."inn"),
  "tax_id" = COALESCE(NULLIF(legacy."tax_id", ''), org."tax_id"),
  "kpp" = COALESCE(NULLIF(legacy."kpp", ''), org."kpp"),
  "ogrn" = COALESCE(NULLIF(legacy."ogrn", ''), org."ogrn"),
  "oktmo" = COALESCE(NULLIF(legacy."oktmo", ''), org."oktmo"),
  "okpo" = COALESCE(NULLIF(legacy."okpo", ''), org."okpo"),
  "director_name" = COALESCE(NULLIF(legacy."director_name", ''), org."director_name"),
  "director_name_i18n" = COALESCE(legacy."director_name_i18n", org."director_name_i18n"),
  "director_position" = COALESCE(NULLIF(legacy."director_position", ''), org."director_position"),
  "director_position_i18n" = COALESCE(legacy."director_position_i18n", org."director_position_i18n"),
  "director_basis" = COALESCE(NULLIF(legacy."director_basis", ''), org."director_basis"),
  "director_basis_i18n" = COALESCE(legacy."director_basis_i18n", org."director_basis_i18n"),
  "signature_key" = COALESCE(NULLIF(legacy."signature_key", ''), org."signature_key"),
  "seal_key" = COALESCE(NULLIF(legacy."seal_key", ''), org."seal_key"),
  "short_name" = COALESCE(NULLIF(legacy."name", ''), org."short_name"),
  "full_name" = CASE
    WHEN NULLIF(trim(org."full_name"), '') IS NULL THEN COALESCE(NULLIF(legacy."name", ''), org."short_name")
    ELSE org."full_name"
  END,
  "updated_at" = now()
FROM "ops_agent_organizations" AS legacy
WHERE legacy."organization_id" = org."id";--> statement-breakpoint
DO $$
DECLARE
  legacy_row RECORD;
  new_organization_id uuid;
BEGIN
  FOR legacy_row IN
    SELECT legacy.*
    FROM "ops_agent_organizations" AS legacy
    LEFT JOIN "organizations" AS org
      ON org."id" = legacy."organization_id"
    WHERE legacy."is_active" = true
      AND org."id" IS NULL
  LOOP
    INSERT INTO "organizations" (
      "short_name",
      "full_name",
      "kind",
      "country",
      "is_active",
      "name_i18n",
      "org_type",
      "org_type_i18n",
      "country_i18n",
      "city",
      "city_i18n",
      "address",
      "address_i18n",
      "inn",
      "tax_id",
      "kpp",
      "ogrn",
      "oktmo",
      "okpo",
      "director_name",
      "director_name_i18n",
      "director_position",
      "director_position_i18n",
      "director_basis",
      "director_basis_i18n",
      "signature_key",
      "seal_key"
    )
    VALUES (
      COALESCE(NULLIF(legacy_row."name", ''), 'Organization ' || legacy_row."id"::text),
      COALESCE(NULLIF(legacy_row."name", ''), 'Organization ' || legacy_row."id"::text),
      'legal_entity'::"party_kind",
      NULLIF(legacy_row."country", ''),
      legacy_row."is_active",
      legacy_row."name_i18n",
      NULLIF(legacy_row."org_type", ''),
      legacy_row."org_type_i18n",
      legacy_row."country_i18n",
      NULLIF(legacy_row."city", ''),
      legacy_row."city_i18n",
      NULLIF(legacy_row."address", ''),
      legacy_row."address_i18n",
      NULLIF(legacy_row."inn", ''),
      NULLIF(legacy_row."tax_id", ''),
      NULLIF(legacy_row."kpp", ''),
      NULLIF(legacy_row."ogrn", ''),
      NULLIF(legacy_row."oktmo", ''),
      NULLIF(legacy_row."okpo", ''),
      NULLIF(legacy_row."director_name", ''),
      legacy_row."director_name_i18n",
      NULLIF(legacy_row."director_position", ''),
      legacy_row."director_position_i18n",
      NULLIF(legacy_row."director_basis", ''),
      legacy_row."director_basis_i18n",
      NULLIF(legacy_row."signature_key", ''),
      NULLIF(legacy_row."seal_key", '')
    )
    RETURNING "id" INTO new_organization_id;

    UPDATE "ops_agent_organizations"
    SET "organization_id" = new_organization_id
    WHERE "id" = legacy_row."id";
  END LOOP;
END $$;--> statement-breakpoint
UPDATE "organizations" AS org
SET
  "kind" = 'legal_entity'::"party_kind",
  "is_active" = legacy."is_active",
  "name_i18n" = COALESCE(legacy."name_i18n", org."name_i18n"),
  "org_type" = COALESCE(NULLIF(legacy."org_type", ''), org."org_type"),
  "org_type_i18n" = COALESCE(legacy."org_type_i18n", org."org_type_i18n"),
  "country" = COALESCE(NULLIF(legacy."country", ''), org."country"),
  "country_i18n" = COALESCE(legacy."country_i18n", org."country_i18n"),
  "city" = COALESCE(NULLIF(legacy."city", ''), org."city"),
  "city_i18n" = COALESCE(legacy."city_i18n", org."city_i18n"),
  "address" = COALESCE(NULLIF(legacy."address", ''), org."address"),
  "address_i18n" = COALESCE(legacy."address_i18n", org."address_i18n"),
  "inn" = COALESCE(NULLIF(legacy."inn", ''), org."inn"),
  "tax_id" = COALESCE(NULLIF(legacy."tax_id", ''), org."tax_id"),
  "kpp" = COALESCE(NULLIF(legacy."kpp", ''), org."kpp"),
  "ogrn" = COALESCE(NULLIF(legacy."ogrn", ''), org."ogrn"),
  "oktmo" = COALESCE(NULLIF(legacy."oktmo", ''), org."oktmo"),
  "okpo" = COALESCE(NULLIF(legacy."okpo", ''), org."okpo"),
  "director_name" = COALESCE(NULLIF(legacy."director_name", ''), org."director_name"),
  "director_name_i18n" = COALESCE(legacy."director_name_i18n", org."director_name_i18n"),
  "director_position" = COALESCE(NULLIF(legacy."director_position", ''), org."director_position"),
  "director_position_i18n" = COALESCE(legacy."director_position_i18n", org."director_position_i18n"),
  "director_basis" = COALESCE(NULLIF(legacy."director_basis", ''), org."director_basis"),
  "director_basis_i18n" = COALESCE(legacy."director_basis_i18n", org."director_basis_i18n"),
  "signature_key" = COALESCE(NULLIF(legacy."signature_key", ''), org."signature_key"),
  "seal_key" = COALESCE(NULLIF(legacy."seal_key", ''), org."seal_key"),
  "short_name" = COALESCE(NULLIF(legacy."name", ''), org."short_name"),
  "full_name" = CASE
    WHEN NULLIF(trim(org."full_name"), '') IS NULL THEN COALESCE(NULLIF(legacy."name", ''), org."short_name")
    ELSE org."full_name"
  END,
  "updated_at" = now()
FROM "ops_agent_organizations" AS legacy
WHERE legacy."organization_id" = org."id";
