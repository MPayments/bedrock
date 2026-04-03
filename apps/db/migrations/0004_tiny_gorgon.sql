DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1
   FROM pg_enum
   WHERE enumlabel = 'attachment_ingested'
     AND enumtypid = 'public.deal_timeline_event_type'::regtype
 ) THEN
   ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'attachment_ingested' BEFORE 'document_created';
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1
   FROM pg_enum
   WHERE enumlabel = 'attachment_ingestion_failed'
     AND enumtypid = 'public.deal_timeline_event_type'::regtype
 ) THEN
   ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'attachment_ingestion_failed' BEFORE 'document_created';
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."file_attachment_purpose" AS ENUM('invoice', 'contract', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."deal_attachment_ingestion_status" AS ENUM('pending', 'processing', 'processed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deal_attachment_ingestions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"file_asset_id" uuid NOT NULL,
	"status" "deal_attachment_ingestion_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"observed_revision" integer NOT NULL,
	"applied_revision" integer,
	"normalized_payload" jsonb DEFAULT null,
	"applied_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skipped_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_code" text,
	"error_message" text,
	"last_processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_attachment_ingestions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deal_attachment_ingestions_file_asset_uq" ON "deal_attachment_ingestions" USING btree ("file_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deal_attachment_ingestions_deal_idx" ON "deal_attachment_ingestions" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deal_attachment_ingestions_status_idx" ON "deal_attachment_ingestions" USING btree ("status","available_at");--> statement-breakpoint
ALTER TABLE "file_links" DROP CONSTRAINT IF EXISTS "file_links_generated_variant_shape_chk";--> statement-breakpoint
ALTER TABLE "file_links" ADD COLUMN IF NOT EXISTS "attachment_purpose" "file_attachment_purpose";--> statement-breakpoint
UPDATE "file_links"
SET "attachment_purpose" = 'other'
WHERE "link_kind" in ('deal_attachment', 'legal_entity_attachment')
  AND "attachment_purpose" IS NULL;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1
   FROM pg_constraint
   WHERE conname = 'file_links_generated_variant_shape_chk'
 ) THEN
   ALTER TABLE "file_links" ADD CONSTRAINT "file_links_generated_variant_shape_chk" CHECK ((
           "file_links"."link_kind" in ('deal_attachment', 'legal_entity_attachment')
           and "file_links"."attachment_purpose" is not null
           and "file_links"."attachment_visibility" is not null
           and "file_links"."generated_format" is null
           and "file_links"."generated_lang" is null
         ) or (
           "file_links"."link_kind" in ('deal_application', 'deal_invoice', 'deal_acceptance', 'legal_entity_contract')
           and "file_links"."attachment_purpose" is null
           and "file_links"."attachment_visibility" is null
           and "file_links"."generated_format" is not null
           and "file_links"."generated_lang" is not null
         ));
 END IF;
END $$;--> statement-breakpoint
