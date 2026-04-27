ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'materialization_failed';--> statement-breakpoint
ALTER TYPE "public"."file_link_kind" ADD VALUE 'agreement_signed_contract' BEFORE 'deal_application';--> statement-breakpoint
ALTER TABLE "file_links" DROP CONSTRAINT "file_links_exactly_one_owner_chk";--> statement-breakpoint
ALTER TABLE "file_links" DROP CONSTRAINT "file_links_generated_variant_shape_chk";--> statement-breakpoint
ALTER TABLE "file_links" ADD COLUMN "agreement_version_id" uuid;--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_links_agreement_version_idx" ON "file_links" USING btree ("agreement_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_links_agreement_signed_contract_uq" ON "file_links" USING btree ("agreement_version_id","link_kind") WHERE "file_links"."agreement_version_id" is not null and "file_links"."link_kind" = 'agreement_signed_contract';--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_exactly_one_owner_chk" CHECK ((
        ("file_links"."deal_id" is not null and "file_links"."counterparty_id" is null and "file_links"."agreement_version_id" is null and "file_links"."payment_step_id" is null)
        or ("file_links"."deal_id" is null and "file_links"."counterparty_id" is not null and "file_links"."agreement_version_id" is null and "file_links"."payment_step_id" is null)
        or ("file_links"."deal_id" is null and "file_links"."counterparty_id" is null and "file_links"."agreement_version_id" is not null and "file_links"."payment_step_id" is null)
        or ("file_links"."deal_id" is null and "file_links"."counterparty_id" is null and "file_links"."agreement_version_id" is null and "file_links"."payment_step_id" is not null)
      ));--> statement-breakpoint
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
      ) or (
        "file_links"."link_kind" in ('deal_application', 'deal_invoice', 'deal_acceptance', 'legal_entity_contract')
        and "file_links"."attachment_purpose" is null
        and "file_links"."attachment_visibility" is null
        and "file_links"."generated_format" is not null
        and "file_links"."generated_lang" is not null
      ));