CREATE TYPE "public"."file_asset_origin" AS ENUM('uploaded', 'generated');
--> statement-breakpoint
CREATE TYPE "public"."file_generated_format" AS ENUM('docx', 'pdf');
--> statement-breakpoint
CREATE TYPE "public"."file_generated_lang" AS ENUM('ru', 'en');
--> statement-breakpoint
CREATE TYPE "public"."file_link_kind" AS ENUM('deal_attachment', 'legal_entity_attachment', 'deal_application', 'deal_invoice', 'deal_acceptance', 'legal_entity_contract');
--> statement-breakpoint
CREATE TABLE "file_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"current_version_id" uuid,
	"origin" "file_asset_origin" NOT NULL,
	"description" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_assets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"file_asset_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"checksum" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_versions_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "file_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "file_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"file_asset_id" uuid NOT NULL,
	"deal_id" uuid,
	"counterparty_id" uuid,
	"link_kind" "file_link_kind" NOT NULL,
	"generated_format" "file_generated_format",
	"generated_lang" "file_generated_lang",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_links_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "file_links_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "file_links_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "file_links_exactly_one_owner_chk" CHECK ((
		("file_links"."deal_id" is not null and "file_links"."counterparty_id" is null)
		or ("file_links"."deal_id" is null and "file_links"."counterparty_id" is not null)
	)),
	CONSTRAINT "file_links_generated_variant_shape_chk" CHECK ((
		"file_links"."link_kind" in ('deal_attachment', 'legal_entity_attachment')
		and "file_links"."generated_format" is null
		and "file_links"."generated_lang" is null
	) or (
		"file_links"."link_kind" in ('deal_application', 'deal_invoice', 'deal_acceptance', 'legal_entity_contract')
		and "file_links"."generated_format" is not null
		and "file_links"."generated_lang" is not null
	))
);
--> statement-breakpoint
ALTER TABLE "ops_client_documents" ADD COLUMN "file_asset_id" uuid;
--> statement-breakpoint
ALTER TABLE "ops_deal_documents" ADD COLUMN "file_asset_id" uuid;
--> statement-breakpoint
CREATE UNIQUE INDEX "file_versions_asset_version_uq" ON "file_versions" USING btree ("file_asset_id","version_number");
--> statement-breakpoint
CREATE UNIQUE INDEX "file_versions_id_asset_uq" ON "file_versions" USING btree ("id","file_asset_id");
--> statement-breakpoint
CREATE INDEX "file_versions_asset_idx" ON "file_versions" USING btree ("file_asset_id");
--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_current_version_belongs_to_asset_fk" FOREIGN KEY ("current_version_id","id") REFERENCES "public"."file_versions"("id","file_asset_id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "file_assets_current_version_uq" ON "file_assets" USING btree ("current_version_id") WHERE "file_assets"."current_version_id" is not null;
--> statement-breakpoint
CREATE INDEX "file_assets_current_version_idx" ON "file_assets" USING btree ("current_version_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "file_links_asset_uq" ON "file_links" USING btree ("file_asset_id");
--> statement-breakpoint
CREATE INDEX "file_links_deal_idx" ON "file_links" USING btree ("deal_id");
--> statement-breakpoint
CREATE INDEX "file_links_counterparty_idx" ON "file_links" USING btree ("counterparty_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "file_links_generated_deal_variant_uq" ON "file_links" USING btree ("deal_id","link_kind","generated_format","generated_lang") WHERE "file_links"."deal_id" is not null and "file_links"."link_kind" in ('deal_application', 'deal_invoice', 'deal_acceptance');
--> statement-breakpoint
CREATE UNIQUE INDEX "file_links_generated_counterparty_variant_uq" ON "file_links" USING btree ("counterparty_id","link_kind","generated_format","generated_lang") WHERE "file_links"."counterparty_id" is not null and "file_links"."link_kind" = 'legal_entity_contract';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."__phase18_parse_timestamptz_strict"(raw text, field_name text)
RETURNS timestamp with time zone
LANGUAGE plpgsql
AS $$
DECLARE
	cleaned text;
BEGIN
	cleaned := btrim(coalesce(raw, ''));
	IF cleaned = '' THEN
		RAISE EXCEPTION 'Phase 18 files migration: % is empty', field_name;
	END IF;

	RETURN cleaned::timestamp with time zone;
EXCEPTION
	WHEN OTHERS THEN
		RAISE EXCEPTION 'Phase 18 files migration: % has invalid timestamp value "%"', field_name, raw;
END
$$;
--> statement-breakpoint
DO $$
DECLARE
	invalid_row record;
BEGIN
	SELECT doc.id, doc.client_id
	INTO invalid_row
	FROM ops_client_documents doc
	JOIN ops_clients client ON client.id = doc.client_id
	WHERE client.counterparty_id IS NULL
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 18 files migration: ops_client_documents.id=% cannot resolve canonical counterparty from ops_clients.id=%', invalid_row.id, invalid_row.client_id;
	END IF;

	SELECT doc.id, doc.deal_id
	INTO invalid_row
	FROM ops_deal_documents doc
	JOIN ops_deals legacy_deal ON legacy_deal.id = doc.deal_id
	WHERE legacy_deal.deal_id IS NULL
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 18 files migration: ops_deal_documents.id=% cannot resolve canonical deal from ops_deals.id=%', invalid_row.id, invalid_row.deal_id;
	END IF;

	SELECT doc.id, doc.file_name, doc.mime_type, doc.s3_key, doc.file_size
	INTO invalid_row
	FROM ops_client_documents doc
	WHERE nullif(btrim(coalesce(doc.file_name, '')), '') IS NULL
		OR nullif(btrim(coalesce(doc.mime_type, '')), '') IS NULL
		OR nullif(btrim(coalesce(doc.s3_key, '')), '') IS NULL
		OR doc.file_size < 0
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 18 files migration: ops_client_documents.id=% has invalid storage metadata', invalid_row.id;
	END IF;

	SELECT doc.id, doc.file_name, doc.mime_type, doc.s3_key, doc.file_size
	INTO invalid_row
	FROM ops_deal_documents doc
	WHERE nullif(btrim(coalesce(doc.file_name, '')), '') IS NULL
		OR nullif(btrim(coalesce(doc.mime_type, '')), '') IS NULL
		OR nullif(btrim(coalesce(doc.s3_key, '')), '') IS NULL
		OR doc.file_size < 0
	LIMIT 1;

	IF FOUND THEN
		RAISE EXCEPTION 'Phase 18 files migration: ops_deal_documents.id=% has invalid storage metadata', invalid_row.id;
	END IF;
END
$$;
--> statement-breakpoint
CREATE TEMP TABLE "__phase18_client_document_backfill" ON COMMIT DROP AS
SELECT
	doc.id AS legacy_document_id,
	gen_random_uuid() AS file_asset_id,
	gen_random_uuid() AS version_id,
	gen_random_uuid() AS link_id,
	client.counterparty_id AS counterparty_id,
	nullif(btrim(coalesce(doc.description, '')), '') AS description,
	doc.uploaded_by AS created_by,
	doc.file_name,
	doc.file_size,
	doc.mime_type,
	doc.s3_key AS storage_key,
	md5(concat_ws(':', 'ops_client_documents', doc.id::text, doc.s3_key, doc.file_name, doc.file_size::text, doc.mime_type)) AS checksum,
	public.__phase18_parse_timestamptz_strict(
		doc.created_at,
		format('ops_client_documents.id=%s created_at', doc.id)
	) AS created_at,
	public.__phase18_parse_timestamptz_strict(
		doc.updated_at,
		format('ops_client_documents.id=%s updated_at', doc.id)
	) AS updated_at
FROM ops_client_documents doc
JOIN ops_clients client
	ON client.id = doc.client_id;
--> statement-breakpoint
CREATE TEMP TABLE "__phase18_deal_document_backfill" ON COMMIT DROP AS
SELECT
	doc.id AS legacy_document_id,
	gen_random_uuid() AS file_asset_id,
	gen_random_uuid() AS version_id,
	gen_random_uuid() AS link_id,
	legacy_deal.deal_id AS deal_id,
	nullif(btrim(coalesce(doc.description, '')), '') AS description,
	doc.uploaded_by AS created_by,
	doc.file_name,
	doc.file_size,
	doc.mime_type,
	doc.s3_key AS storage_key,
	md5(concat_ws(':', 'ops_deal_documents', doc.id::text, doc.s3_key, doc.file_name, doc.file_size::text, doc.mime_type)) AS checksum,
	public.__phase18_parse_timestamptz_strict(
		doc.created_at,
		format('ops_deal_documents.id=%s created_at', doc.id)
	) AS created_at,
	public.__phase18_parse_timestamptz_strict(
		doc.updated_at,
		format('ops_deal_documents.id=%s updated_at', doc.id)
	) AS updated_at
FROM ops_deal_documents doc
JOIN ops_deals legacy_deal
	ON legacy_deal.id = doc.deal_id;
--> statement-breakpoint
INSERT INTO "file_assets" (
	"id",
	"current_version_id",
	"origin",
	"description",
	"created_by",
	"created_at",
	"updated_at"
)
SELECT
	backfill.file_asset_id,
	NULL::uuid,
	'uploaded'::"public"."file_asset_origin",
	backfill.description,
	backfill.created_by,
	backfill.created_at,
	backfill.updated_at
FROM "__phase18_client_document_backfill" backfill
UNION ALL
SELECT
	backfill.file_asset_id,
	NULL::uuid,
	'uploaded'::"public"."file_asset_origin",
	backfill.description,
	backfill.created_by,
	backfill.created_at,
	backfill.updated_at
FROM "__phase18_deal_document_backfill" backfill;
--> statement-breakpoint
INSERT INTO "file_versions" (
	"id",
	"file_asset_id",
	"version_number",
	"file_name",
	"mime_type",
	"file_size",
	"storage_key",
	"checksum",
	"created_by",
	"created_at",
	"updated_at"
)
SELECT
	backfill.version_id,
	backfill.file_asset_id,
	1,
	backfill.file_name,
	backfill.mime_type,
	backfill.file_size,
	backfill.storage_key,
	backfill.checksum,
	backfill.created_by,
	backfill.created_at,
	backfill.updated_at
FROM "__phase18_client_document_backfill" backfill
UNION ALL
SELECT
	backfill.version_id,
	backfill.file_asset_id,
	1,
	backfill.file_name,
	backfill.mime_type,
	backfill.file_size,
	backfill.storage_key,
	backfill.checksum,
	backfill.created_by,
	backfill.created_at,
	backfill.updated_at
FROM "__phase18_deal_document_backfill" backfill;
--> statement-breakpoint
INSERT INTO "file_links" (
	"id",
	"file_asset_id",
	"deal_id",
	"counterparty_id",
	"link_kind",
	"generated_format",
	"generated_lang",
	"created_at",
	"updated_at"
)
SELECT
	backfill.link_id,
	backfill.file_asset_id,
	NULL::uuid,
	backfill.counterparty_id,
	'legal_entity_attachment'::"public"."file_link_kind",
	NULL::"public"."file_generated_format",
	NULL::"public"."file_generated_lang",
	backfill.created_at,
	backfill.updated_at
FROM "__phase18_client_document_backfill" backfill
UNION ALL
SELECT
	backfill.link_id,
	backfill.file_asset_id,
	backfill.deal_id,
	NULL::uuid,
	'deal_attachment'::"public"."file_link_kind",
	NULL::"public"."file_generated_format",
	NULL::"public"."file_generated_lang",
	backfill.created_at,
	backfill.updated_at
FROM "__phase18_deal_document_backfill" backfill;
--> statement-breakpoint
UPDATE "file_assets" asset
SET "current_version_id" = versions.version_id
FROM (
	SELECT backfill.file_asset_id, backfill.version_id
	FROM "__phase18_client_document_backfill" backfill
	UNION ALL
	SELECT backfill.file_asset_id, backfill.version_id
	FROM "__phase18_deal_document_backfill" backfill
) versions
WHERE asset.id = versions.file_asset_id;
--> statement-breakpoint
UPDATE "ops_client_documents" doc
SET "file_asset_id" = backfill.file_asset_id
FROM "__phase18_client_document_backfill" backfill
WHERE doc.id = backfill.legacy_document_id;
--> statement-breakpoint
UPDATE "ops_deal_documents" doc
SET "file_asset_id" = backfill.file_asset_id
FROM "__phase18_deal_document_backfill" backfill
WHERE doc.id = backfill.legacy_document_id;
--> statement-breakpoint
ALTER TABLE "ops_client_documents" ADD CONSTRAINT "ops_client_documents_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops_deal_documents" ADD CONSTRAINT "ops_deal_documents_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops_client_documents" ADD CONSTRAINT "ops_client_documents_file_asset_id_unique" UNIQUE("file_asset_id");
--> statement-breakpoint
ALTER TABLE "ops_deal_documents" ADD CONSTRAINT "ops_deal_documents_file_asset_id_unique" UNIQUE("file_asset_id");
