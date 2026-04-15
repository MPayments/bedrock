DELETE FROM "file_assets"
USING "file_links"
WHERE "file_links"."file_asset_id" = "file_assets"."id"
  AND "file_links"."link_kind"::text = 'deal_application';--> statement-breakpoint
ALTER TABLE "file_links" DROP CONSTRAINT "file_links_generated_variant_shape_chk";--> statement-breakpoint
ALTER TABLE "file_links" ALTER COLUMN "link_kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."file_link_kind";--> statement-breakpoint
CREATE TYPE "public"."file_link_kind" AS ENUM('deal_attachment', 'legal_entity_attachment', 'deal_invoice', 'deal_acceptance', 'legal_entity_contract');--> statement-breakpoint
ALTER TABLE "file_links" ALTER COLUMN "link_kind" SET DATA TYPE "public"."file_link_kind" USING "link_kind"::"public"."file_link_kind";--> statement-breakpoint
DROP INDEX "file_links_generated_deal_variant_uq";--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "route_version_id" uuid;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "route_leg_id" uuid;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "route_component_id" uuid;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "component_code" text;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "component_family" text;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "classification" "calculation_component_classification";--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "formula_type" "calculation_component_formula_type";--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "basis_type" "calculation_component_basis_type";--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "basis_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "input_bps" text;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "input_fixed_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "input_per_million" text;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "input_manual_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD COLUMN "source_kind" "calculation_line_source_kind" DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "deal_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "route_version_id" uuid;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "route_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "gross_revenue_in_base_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "expense_amount_in_base_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "pass_through_amount_in_base_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "net_margin_in_base_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD COLUMN "state" "calculation_state" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "treasury_operations" ADD COLUMN "route_leg_id" uuid;--> statement-breakpoint
CREATE INDEX "calculation_lines_deal_idx" ON "calculation_lines" USING btree ("deal_id","idx");--> statement-breakpoint
CREATE INDEX "calculation_lines_route_version_idx" ON "calculation_lines" USING btree ("route_version_id","idx");--> statement-breakpoint
CREATE INDEX "calculation_lines_route_leg_idx" ON "calculation_lines" USING btree ("route_leg_id","idx");--> statement-breakpoint
CREATE INDEX "calculation_snapshots_deal_idx" ON "calculation_snapshots" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE INDEX "calculation_snapshots_route_version_idx" ON "calculation_snapshots" USING btree ("route_version_id");--> statement-breakpoint
CREATE INDEX "calculation_snapshots_state_idx" ON "calculation_snapshots" USING btree ("state","created_at");--> statement-breakpoint
CREATE INDEX "treasury_operations_route_leg_idx" ON "treasury_operations" USING btree ("route_leg_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_links_generated_deal_variant_uq" ON "file_links" USING btree ("deal_id","link_kind","generated_format","generated_lang") WHERE "file_links"."deal_id" is not null and "file_links"."link_kind" in ('deal_invoice', 'deal_acceptance');--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_generated_variant_shape_chk" CHECK ((
        "file_links"."link_kind" in ('deal_attachment', 'legal_entity_attachment')
        and "file_links"."attachment_purpose" is not null
        and "file_links"."attachment_visibility" is not null
        and "file_links"."generated_format" is null
        and "file_links"."generated_lang" is null
      ) or (
        "file_links"."link_kind" in ('deal_invoice', 'deal_acceptance', 'legal_entity_contract')
        and "file_links"."attachment_purpose" is null
        and "file_links"."attachment_visibility" is null
        and "file_links"."generated_format" is not null
        and "file_links"."generated_lang" is not null
      ));
