ALTER TABLE "treasury_instruction_artifacts"
  ADD CONSTRAINT "treasury_instruction_artifacts_file_asset_id_file_assets_id_fk"
  FOREIGN KEY ("file_asset_id")
  REFERENCES "public"."file_assets"("id")
  ON DELETE RESTRICT
  ON UPDATE NO ACTION;
