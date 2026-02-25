CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint

CREATE OR REPLACE FUNCTION bedrock_tb_u128_from_hash(input text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    b bytea := digest(input, 'sha256');
    i integer;
    result numeric := 0;
    max_u128 constant numeric := 340282366920938463463374607431768211455;
BEGIN
    FOR i IN 0..15 LOOP
        result := (result * 256) + get_byte(b, i);
    END LOOP;

    IF result <= 0 THEN
        RETURN 1;
    END IF;

    IF result >= max_u128 THEN
        RETURN max_u128 - 1;
    END IF;

    RETURN result;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION bedrock_tb_ledger_for_currency(input text)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    b bytea := digest('cur:' || input, 'sha256');
    ledger bigint;
BEGIN
    ledger :=
        ((get_byte(b, 0)::bigint << 24)
      + (get_byte(b, 1)::bigint << 16)
      + (get_byte(b, 2)::bigint << 8)
      +  get_byte(b, 3)::bigint);

    IF ledger = 0 THEN
        RETURN 1;
    END IF;

    RETURN ledger;
END;
$$;--> statement-breakpoint

CREATE TEMP TABLE coa_map (
    old_no text PRIMARY KEY,
    new_no text NOT NULL
);--> statement-breakpoint

INSERT INTO coa_map (old_no, new_no) VALUES
    ('51.01', '1110'),
    ('57.01', '1210'),
    ('57.02', '1220'),
    ('62.01', '2110'),
    ('76.10', '2120'),
    ('76.20', '2130'),
    ('79.01', '1310'),
    ('90.01', '4110'),
    ('90.02', '4120'),
    ('91.01', '4130'),
    ('91.02', '5110');--> statement-breakpoint

ALTER TABLE "chart_template_accounts"
DROP CONSTRAINT IF EXISTS "chart_template_account_no_fmt";--> statement-breakpoint

INSERT INTO "chart_template_accounts" (
    "account_no",
    "name",
    "kind",
    "normal_side",
    "posting_allowed",
    "parent_account_no"
)
VALUES
    ('1000', 'Активы', 'asset', 'debit', false, null),
    ('1100', 'Денежные средства и эквиваленты', 'asset', 'debit', false, '1000'),
    ('1200', 'Операционные активы', 'asset', 'debit', false, '1000'),
    ('1300', 'Внутригрупповые расчеты', 'active_passive', 'both', false, '1000'),
    ('2000', 'Обязательства', 'liability', 'credit', false, null),
    ('2100', 'Операционные обязательства', 'liability', 'credit', false, '2000'),
    ('3000', 'Капитал', 'equity', 'credit', false, null),
    ('4000', 'Доходы', 'revenue', 'credit', false, null),
    ('5000', 'Расходы', 'expense', 'debit', false, null),
    ('1110', 'Банк', 'asset', 'debit', true, '1100'),
    ('1210', 'Резерв по ордерам', 'asset', 'debit', true, '1200'),
    ('1220', 'Транзит', 'asset', 'debit', true, '1200'),
    ('1310', 'Внутригрупповой неттинг', 'active_passive', 'both', true, '1300'),
    ('2110', 'Кошелек клиента', 'liability', 'credit', true, '2100'),
    ('2120', 'Клиринг комиссий', 'liability', 'credit', true, '2100'),
    ('2130', 'Обязательство по выплате', 'liability', 'credit', true, '2100'),
    ('4110', 'Доход от комиссий', 'revenue', 'credit', true, '4000'),
    ('4120', 'Доход от спреда', 'revenue', 'credit', true, '4000'),
    ('4130', 'Доход от корректировок', 'revenue', 'credit', true, '4000'),
    ('5110', 'Расход по корректировкам', 'expense', 'debit', true, '5000')
ON CONFLICT ("account_no") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "kind" = EXCLUDED."kind",
    "normal_side" = EXCLUDED."normal_side",
    "posting_allowed" = EXCLUDED."posting_allowed",
    "parent_account_no" = EXCLUDED."parent_account_no";--> statement-breakpoint

INSERT INTO "chart_template_account_analytics" (
    "account_no",
    "analytic_type",
    "required"
)
SELECT
    m."new_no",
    a."analytic_type",
    a."required"
FROM "chart_template_account_analytics" a
JOIN coa_map m ON m."old_no" = a."account_no"
ON CONFLICT ("account_no", "analytic_type") DO UPDATE
SET "required" = EXCLUDED."required";--> statement-breakpoint

DELETE FROM "chart_template_account_analytics" a
USING coa_map m
WHERE a."account_no" = m."old_no";--> statement-breakpoint

INSERT INTO "chart_org_overrides" (
    "org_id",
    "account_no",
    "enabled",
    "name_override",
    "created_at",
    "updated_at"
)
SELECT
    o."org_id",
    m."new_no",
    o."enabled",
    o."name_override",
    o."created_at",
    o."updated_at"
FROM "chart_org_overrides" o
JOIN coa_map m ON m."old_no" = o."account_no"
ON CONFLICT ("org_id", "account_no") DO UPDATE
SET
    "enabled" = EXCLUDED."enabled",
    "name_override" = EXCLUDED."name_override",
    "updated_at" = EXCLUDED."updated_at";--> statement-breakpoint

DELETE FROM "chart_org_overrides" o
USING coa_map m
WHERE o."account_no" = m."old_no";--> statement-breakpoint

UPDATE "correspondence_rules"
SET
    "debit_account_no" = CASE "debit_account_no"
        WHEN '51.01' THEN '1110'
        WHEN '57.01' THEN '1210'
        WHEN '57.02' THEN '1220'
        WHEN '62.01' THEN '2110'
        WHEN '76.10' THEN '2120'
        WHEN '76.20' THEN '2130'
        WHEN '79.01' THEN '1310'
        WHEN '90.01' THEN '4110'
        WHEN '90.02' THEN '4120'
        WHEN '91.01' THEN '4130'
        WHEN '91.02' THEN '5110'
        ELSE "debit_account_no"
    END,
    "credit_account_no" = CASE "credit_account_no"
        WHEN '51.01' THEN '1110'
        WHEN '57.01' THEN '1210'
        WHEN '57.02' THEN '1220'
        WHEN '62.01' THEN '2110'
        WHEN '76.10' THEN '2120'
        WHEN '76.20' THEN '2130'
        WHEN '79.01' THEN '1310'
        WHEN '90.01' THEN '4110'
        WHEN '90.02' THEN '4120'
        WHEN '91.01' THEN '4130'
        WHEN '91.02' THEN '5110'
        ELSE "credit_account_no"
    END,
    "updated_at" = now();--> statement-breakpoint

UPDATE "book_accounts"
SET "account_no" = CASE "account_no"
    WHEN '51.01' THEN '1110'
    WHEN '57.01' THEN '1210'
    WHEN '57.02' THEN '1220'
    WHEN '62.01' THEN '2110'
    WHEN '76.10' THEN '2120'
    WHEN '76.20' THEN '2130'
    WHEN '79.01' THEN '1310'
    WHEN '90.01' THEN '4110'
    WHEN '90.02' THEN '4120'
    WHEN '91.01' THEN '4130'
    WHEN '91.02' THEN '5110'
    ELSE "account_no"
END;--> statement-breakpoint

UPDATE "book_accounts"
SET "tb_ledger" = bedrock_tb_ledger_for_currency("currency");--> statement-breakpoint

UPDATE "book_accounts"
SET "tb_account_id" = bedrock_tb_u128_from_hash(
    'book:' || "org_id"::text || ':' || "account_no" || ':' || "currency" || ':' || "tb_ledger"::text
);--> statement-breakpoint

DELETE FROM "chart_template_accounts"
WHERE "account_no" IN (SELECT "old_no" FROM coa_map);--> statement-breakpoint

ALTER TABLE "chart_template_accounts"
ADD CONSTRAINT "chart_template_account_no_fmt"
CHECK ("chart_template_accounts"."account_no" ~ '^[0-9]{4}$');--> statement-breakpoint

DROP FUNCTION IF EXISTS bedrock_tb_u128_from_hash(text);--> statement-breakpoint
DROP FUNCTION IF EXISTS bedrock_tb_ledger_for_currency(text);--> statement-breakpoint
