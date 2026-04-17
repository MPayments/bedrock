WITH normalized AS (
  SELECT
    id,
    jsonb_set(
      draft,
      '{legs}',
      COALESCE(
        (
          SELECT jsonb_agg(leg.value - 'kind' ORDER BY leg.ordinality)
          FROM jsonb_array_elements(
            COALESCE(draft -> 'legs', '[]'::jsonb)
          ) WITH ORDINALITY AS leg(value, ordinality)
        ),
        '[]'::jsonb
      ),
      true
    ) AS next_draft,
    CASE
      WHEN last_calculation IS NULL THEN NULL
      ELSE jsonb_set(
        last_calculation,
        '{legs}',
        COALESCE(
          (
            SELECT jsonb_agg(leg.value - 'kind' ORDER BY leg.ordinality)
            FROM jsonb_array_elements(
              COALESCE(last_calculation -> 'legs', '[]'::jsonb)
            ) WITH ORDINALITY AS leg(value, ordinality)
          ),
          '[]'::jsonb
        ),
        true
      )
    END AS next_last_calculation
  FROM payment_route_templates
)
UPDATE payment_route_templates AS template
SET
  draft = normalized.next_draft,
  last_calculation = normalized.next_last_calculation
FROM normalized
WHERE template.id = normalized.id
  AND (
    template.draft IS DISTINCT FROM normalized.next_draft
    OR template.last_calculation IS DISTINCT FROM normalized.next_last_calculation
  );
