WITH normalized AS (
  SELECT
    id,
    jsonb_set(
      jsonb_set(
        draft,
        '{legs}',
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_set(
                leg.value,
                '{fees}',
                COALESCE(
                  (
                    SELECT jsonb_agg(
                      CASE
                        WHEN fee.value ? 'chargeToCustomer'
                          THEN fee.value
                        ELSE fee.value || jsonb_build_object(
                          'chargeToCustomer',
                          false
                        )
                      END
                      ORDER BY fee.ordinality
                    )
                    FROM jsonb_array_elements(
                      COALESCE(leg.value -> 'fees', '[]'::jsonb)
                    ) WITH ORDINALITY AS fee(value, ordinality)
                  ),
                  '[]'::jsonb
                ),
                true
              )
              ORDER BY leg.ordinality
            )
            FROM jsonb_array_elements(
              COALESCE(draft -> 'legs', '[]'::jsonb)
            ) WITH ORDINALITY AS leg(value, ordinality)
          ),
          '[]'::jsonb
        ),
        true
      ),
      '{additionalFees}',
      COALESCE(
        (
          SELECT jsonb_agg(
            CASE
              WHEN fee.value ? 'chargeToCustomer'
                THEN fee.value
              ELSE fee.value || jsonb_build_object(
                'chargeToCustomer',
                false
              )
            END
            ORDER BY fee.ordinality
          )
          FROM jsonb_array_elements(
            COALESCE(draft -> 'additionalFees', '[]'::jsonb)
          ) WITH ORDINALITY AS fee(value, ordinality)
        ),
        '[]'::jsonb
      ),
      true
    ) AS next_draft,
    CASE
      WHEN last_calculation IS NULL THEN NULL
      WHEN last_calculation ? 'cleanAmountOutMinor'
        AND last_calculation ? 'clientTotalInMinor'
        AND last_calculation ? 'costPriceInMinor'
        AND last_calculation ? 'chargedFeeTotals'
        AND last_calculation ? 'internalFeeTotals'
        THEN last_calculation
      ELSE NULL
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
