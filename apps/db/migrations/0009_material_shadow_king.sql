ALTER TABLE "file_links" DROP CONSTRAINT "file_links_generated_variant_shape_chk";--> statement-breakpoint
ALTER TABLE "file_links" ALTER COLUMN "link_kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."file_link_kind";--> statement-breakpoint
CREATE TYPE "public"."file_link_kind" AS ENUM('deal_attachment', 'legal_entity_attachment', 'agreement_signed_contract', 'payment_step_evidence');--> statement-breakpoint
ALTER TABLE "file_links" ALTER COLUMN "link_kind" SET DATA TYPE "public"."file_link_kind" USING "link_kind"::"public"."file_link_kind";--> statement-breakpoint
DROP INDEX "file_links_generated_deal_variant_uq";--> statement-breakpoint
DROP INDEX "file_links_generated_counterparty_variant_uq";--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_generated_variant_shape_chk" CHECK ((
        "file_links"."link_kind" in ('deal_attachment', 'legal_entity_attachment', 'payment_step_evidence')
        and "file_links"."attachment_purpose" is not null
        and "file_links"."attachment_visibility" is not null
        and "file_links"."generated_format" is null
        and "file_links"."generated_lang" is null
      ) or (
        "file_links"."link_kind" = 'agreement_signed_contract'
        and "file_links"."attachment_purpose" is null
        and "file_links"."attachment_visibility" is null
        and "file_links"."generated_format" is null
        and "file_links"."generated_lang" is null
      ));