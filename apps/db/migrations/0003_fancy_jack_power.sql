DO $$
BEGIN
    CREATE TYPE "public"."file_attachment_visibility" AS ENUM('customer_safe', 'internal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "file_links" DROP CONSTRAINT "file_links_generated_variant_shape_chk";--> statement-breakpoint
ALTER TABLE "file_links" ADD COLUMN "attachment_visibility" "file_attachment_visibility";--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_generated_variant_shape_chk" CHECK ((
        "file_links"."link_kind" in ('deal_attachment', 'legal_entity_attachment')
        and "file_links"."attachment_visibility" is not null
        and "file_links"."generated_format" is null
        and "file_links"."generated_lang" is null
      ) or (
        "file_links"."link_kind" in ('deal_application', 'deal_invoice', 'deal_acceptance', 'legal_entity_contract')
        and "file_links"."attachment_visibility" is null
        and "file_links"."generated_format" is not null
        and "file_links"."generated_lang" is not null
      ));
