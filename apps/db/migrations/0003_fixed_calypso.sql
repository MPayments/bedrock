CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint

ALTER TABLE "ops_contracts" ALTER COLUMN "agent_organization_bank_details_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_deals" ALTER COLUMN "agent_organization_bank_details_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_contracts" ADD COLUMN "organization_requisite_id" uuid;--> statement-breakpoint
ALTER TABLE "ops_deals" ADD COLUMN "organization_requisite_id" uuid;--> statement-breakpoint
ALTER TABLE "ops_contracts" ADD CONSTRAINT "ops_contracts_organization_requisite_id_requisites_id_fk" FOREIGN KEY ("organization_requisite_id") REFERENCES "public"."requisites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_deals" ADD CONSTRAINT "ops_deals_organization_requisite_id_requisites_id_fk" FOREIGN KEY ("organization_requisite_id") REFERENCES "public"."requisites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE OR REPLACE FUNCTION phase10_tb_ledger_for_currency(input text)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  h bytea;
  x bigint;
BEGIN
  h := digest('cur:' || input, 'sha256');
  x :=
    (get_byte(h, 0)::bigint << 24) |
    (get_byte(h, 1)::bigint << 16) |
    (get_byte(h, 2)::bigint << 8) |
    get_byte(h, 3)::bigint;

  IF x = 0 THEN
    RETURN 1;
  END IF;

  RETURN x;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION phase10_tb_u128(input text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  h bytea;
  x numeric := 0;
  i integer;
  max_id numeric := power(2::numeric, 128) - 1;
BEGIN
  h := digest(input, 'sha256');

  FOR i IN 0..15 LOOP
    x := (x * 256) + get_byte(h, i);
  END LOOP;

  IF x <= 0 THEN
    RETURN 1;
  END IF;

  IF x >= max_id THEN
    RETURN max_id - 1;
  END IF;

  RETURN x;
END;
$$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ops_agent_organization_bank_details bank_details
    INNER JOIN ops_agent_organizations legacy_organizations
      ON legacy_organizations.id = bank_details.organization_id
    WHERE bank_details.is_active = true
      AND legacy_organizations.organization_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Phase 10 requires canonical organization_id on every active ops_agent_organization_bank_details row';
  END IF;
END
$$;--> statement-breakpoint

DO $$
DECLARE
  bank_row record;
  provider_country text;
  provider_name text;
  provider_key text;
  resolved_provider_id uuid;
  resolved_requisite_id uuid;
  resolved_currency_id uuid;
  requisite_label text;
BEGIN
  FOR bank_row IN
    SELECT
      bank_details.id,
      bank_details.organization_id AS legacy_organization_id,
      bank_details.requisite_id AS legacy_requisite_id,
      bank_details.name,
      bank_details.bank_name,
      bank_details.bank_address,
      bank_details.account,
      bank_details.bic,
      bank_details.corr_account,
      bank_details.swift_code,
      bank_details.currency_code,
      legacy_organizations.organization_id AS canonical_organization_id,
      organizations.short_name AS organization_short_name,
      organizations.full_name AS organization_full_name,
      organizations.country AS organization_country
    FROM ops_agent_organization_bank_details bank_details
    INNER JOIN ops_agent_organizations legacy_organizations
      ON legacy_organizations.id = bank_details.organization_id
    INNER JOIN organizations
      ON organizations.id = legacy_organizations.organization_id
    WHERE bank_details.is_active = true
    ORDER BY bank_details.id
  LOOP
    resolved_provider_id := NULL;
    resolved_requisite_id := bank_row.legacy_requisite_id;
    resolved_currency_id := NULL;
    provider_country := bank_row.organization_country;
    provider_name := COALESCE(NULLIF(btrim(bank_row.bank_name), ''), NULLIF(btrim(bank_row.name), ''), 'Bank');
    provider_key := lower(regexp_replace(COALESCE(provider_name, ''), '\s+', ' ', 'g'));
    requisite_label := COALESCE(
      NULLIF(btrim(bank_row.name), ''),
      NULLIF(btrim(bank_row.bank_name), ''),
      trim(
        BOTH ' '
        FROM COALESCE(bank_row.organization_short_name, bank_row.organization_full_name, 'Organization')
          || ' '
          || COALESCE(bank_row.currency_code, '')
      )
    );

    IF resolved_requisite_id IS NOT NULL THEN
      SELECT provider_id, currency_id
      INTO resolved_provider_id, resolved_currency_id
      FROM requisites
      WHERE id = resolved_requisite_id
      LIMIT 1;
    END IF;

    IF resolved_provider_id IS NULL AND NULLIF(btrim(bank_row.swift_code), '') IS NOT NULL THEN
      SELECT id
      INTO resolved_provider_id
      FROM requisite_providers
      WHERE kind = 'bank'
        AND archived_at IS NULL
        AND swift = bank_row.swift_code
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF resolved_provider_id IS NULL AND NULLIF(btrim(bank_row.bic), '') IS NOT NULL THEN
      SELECT id
      INTO resolved_provider_id
      FROM requisite_providers
      WHERE kind = 'bank'
        AND archived_at IS NULL
        AND bic = bank_row.bic
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF resolved_provider_id IS NULL THEN
      SELECT id
      INTO resolved_provider_id
      FROM requisite_providers
      WHERE kind = 'bank'
        AND archived_at IS NULL
        AND lower(regexp_replace(name, '\s+', ' ', 'g')) = provider_key
        AND COALESCE(country, '') = COALESCE(provider_country, '')
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF resolved_provider_id IS NULL THEN
      INSERT INTO requisite_providers (
        kind,
        name,
        country,
        address,
        bic,
        swift
      )
      VALUES (
        'bank',
        provider_name,
        provider_country,
        bank_row.bank_address,
        bank_row.bic,
        bank_row.swift_code
      )
      RETURNING id INTO resolved_provider_id;
    END IF;

    IF resolved_currency_id IS NULL THEN
      SELECT id
      INTO resolved_currency_id
      FROM currencies
      WHERE code = bank_row.currency_code
      LIMIT 1;
    END IF;

    IF resolved_currency_id IS NULL THEN
      RAISE EXCEPTION
        'Phase 10 could not resolve currency_id for code % (bank_details.id=%)',
        bank_row.currency_code,
        bank_row.id;
    END IF;

    IF resolved_requisite_id IS NOT NULL THEN
      UPDATE requisites
      SET
        owner_type = 'organization',
        organization_id = bank_row.canonical_organization_id,
        counterparty_id = NULL,
        provider_id = resolved_provider_id,
        currency_id = resolved_currency_id,
        kind = 'bank',
        label = requisite_label,
        description = NULL,
        beneficiary_name = COALESCE(bank_row.organization_full_name, bank_row.organization_short_name),
        institution_name = bank_row.bank_name,
        institution_country = COALESCE(provider_country, bank_row.organization_country),
        account_no = bank_row.account,
        corr_account = bank_row.corr_account,
        bic = bank_row.bic,
        swift = bank_row.swift_code,
        bank_address = bank_row.bank_address,
        archived_at = NULL,
        updated_at = now()
      WHERE id = resolved_requisite_id;
    ELSE
      INSERT INTO requisites (
        owner_type,
        organization_id,
        counterparty_id,
        provider_id,
        currency_id,
        kind,
        label,
        description,
        beneficiary_name,
        institution_name,
        institution_country,
        account_no,
        corr_account,
        bic,
        swift,
        bank_address,
        is_default
      )
      VALUES (
        'organization',
        bank_row.canonical_organization_id,
        NULL,
        resolved_provider_id,
        resolved_currency_id,
        'bank',
        requisite_label,
        NULL,
        COALESCE(bank_row.organization_full_name, bank_row.organization_short_name),
        bank_row.bank_name,
        COALESCE(provider_country, bank_row.organization_country),
        bank_row.account,
        bank_row.corr_account,
        bank_row.bic,
        bank_row.swift_code,
        bank_row.bank_address,
        false
      )
      RETURNING id INTO resolved_requisite_id;
    END IF;

    UPDATE ops_agent_organization_bank_details
    SET requisite_id = resolved_requisite_id
    WHERE id = bank_row.id;
  END LOOP;
END
$$;--> statement-breakpoint

UPDATE requisites
SET is_default = false
WHERE id IN (
  SELECT requisite_id
  FROM ops_agent_organization_bank_details
  WHERE is_active = true
    AND requisite_id IS NOT NULL
);--> statement-breakpoint

WITH default_requisite_candidates AS (
  SELECT
    legacy_organizations.organization_id,
    bank_details.currency_code,
    min(bank_details.requisite_id::text)::uuid AS requisite_id
  FROM ops_agent_organization_bank_details bank_details
  INNER JOIN ops_agent_organizations legacy_organizations
    ON legacy_organizations.id = bank_details.organization_id
  WHERE bank_details.is_active = true
    AND bank_details.requisite_id IS NOT NULL
  GROUP BY
    legacy_organizations.organization_id,
    bank_details.currency_code
  HAVING count(DISTINCT bank_details.requisite_id) = 1
)
UPDATE requisites
SET is_default = true
WHERE id IN (
  SELECT requisite_id
  FROM default_requisite_candidates
);--> statement-breakpoint

INSERT INTO books (
  owner_id,
  code,
  name,
  is_default
)
SELECT DISTINCT
  legacy_organizations.organization_id,
  'organization-default:' || legacy_organizations.organization_id,
  'Organization ' || legacy_organizations.organization_id || ' default book',
  true
FROM ops_agent_organization_bank_details bank_details
INNER JOIN ops_agent_organizations legacy_organizations
  ON legacy_organizations.id = bank_details.organization_id
WHERE bank_details.is_active = true
  AND bank_details.requisite_id IS NOT NULL
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint

INSERT INTO book_account_instances (
  book_id,
  account_no,
  currency,
  dimensions,
  dimensions_hash,
  tb_ledger,
  tb_account_id
)
SELECT DISTINCT
  books.id,
  '1110',
  currencies.code,
  jsonb_build_object('organizationRequisiteId', requisites.id),
  encode(
    digest(
      format('{"organizationRequisiteId":"%s"}', requisites.id),
      'sha256'
    ),
    'hex'
  ),
  phase10_tb_ledger_for_currency(currencies.code),
  phase10_tb_u128(
    'instance:'
    || books.id
    || ':1110:'
    || currencies.code
    || ':'
    || encode(
      digest(
        format('{"organizationRequisiteId":"%s"}', requisites.id),
        'sha256'
      ),
      'hex'
    )
    || ':'
    || phase10_tb_ledger_for_currency(currencies.code)
  )
FROM ops_agent_organization_bank_details bank_details
INNER JOIN requisites
  ON requisites.id = bank_details.requisite_id
INNER JOIN currencies
  ON currencies.id = requisites.currency_id
INNER JOIN books
  ON books.owner_id = requisites.organization_id
 AND books.is_default = true
WHERE bank_details.is_active = true
  AND bank_details.requisite_id IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO organization_requisite_bindings (
  requisite_id,
  book_id,
  book_account_instance_id,
  posting_account_no
)
SELECT
  requisites.id,
  books.id,
  book_account_instances.id,
  '1110'
FROM ops_agent_organization_bank_details bank_details
INNER JOIN requisites
  ON requisites.id = bank_details.requisite_id
INNER JOIN currencies
  ON currencies.id = requisites.currency_id
INNER JOIN books
  ON books.owner_id = requisites.organization_id
 AND books.is_default = true
INNER JOIN book_account_instances
  ON book_account_instances.book_id = books.id
 AND book_account_instances.account_no = '1110'
 AND book_account_instances.currency = currencies.code
 AND book_account_instances.dimensions_hash = encode(
   digest(
     format('{"organizationRequisiteId":"%s"}', requisites.id),
     'sha256'
   ),
   'hex'
 )
WHERE bank_details.is_active = true
  AND bank_details.requisite_id IS NOT NULL
ON CONFLICT ("requisite_id") DO UPDATE
SET
  book_id = excluded.book_id,
  book_account_instance_id = excluded.book_account_instance_id,
  posting_account_no = excluded.posting_account_no,
  updated_at = now();--> statement-breakpoint

UPDATE ops_contracts contracts
SET organization_requisite_id = bank_details.requisite_id
FROM ops_agent_organization_bank_details bank_details
WHERE contracts.organization_requisite_id IS NULL
  AND contracts.agent_organization_bank_details_id = bank_details.id
  AND bank_details.requisite_id IS NOT NULL;--> statement-breakpoint

UPDATE ops_deals deals
SET organization_requisite_id = bank_details.requisite_id
FROM ops_agent_organization_bank_details bank_details
WHERE deals.organization_requisite_id IS NULL
  AND deals.agent_organization_bank_details_id = bank_details.id
  AND bank_details.requisite_id IS NOT NULL;--> statement-breakpoint

DROP FUNCTION phase10_tb_ledger_for_currency(text);--> statement-breakpoint
DROP FUNCTION phase10_tb_u128(text);--> statement-breakpoint
