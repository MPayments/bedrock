ALTER TABLE "accounting_pack_versions"
ALTER COLUMN "compiled_json" SET NOT NULL;

UPDATE "accounting_pack_versions" AS "apv"
SET "compiled_json" = jsonb_set(
  "apv"."compiled_json",
  '{templates}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN "template" ? 'allowModules'
          THEN ("template" - 'allowModules') || jsonb_build_object(
            'allowSources',
            "template"->'allowModules'
          )
        ELSE "template"
      END
      ORDER BY "ordinality"
    )
    FROM jsonb_array_elements("apv"."compiled_json"->'templates')
      WITH ORDINALITY AS "items"("template", "ordinality")
  ),
  true
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements("apv"."compiled_json"->'templates') AS "items"("template")
  WHERE "template" ? 'allowModules'
);
