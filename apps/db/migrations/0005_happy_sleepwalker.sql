WITH normalized AS (
  SELECT
    id,
    jsonb_set(
      jsonb_set(
        last_calculation,
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
                        WHEN fee.value ? 'inputImpactCurrencyId'
                          AND fee.value ? 'inputImpactMinor'
                          THEN fee.value
                        ELSE fee.value || jsonb_build_object(
                          'inputImpactCurrencyId',
                          fee.value -> 'currencyId',
                          'inputImpactMinor',
                          fee.value -> 'amountMinor'
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
              COALESCE(last_calculation -> 'legs', '[]'::jsonb)
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
              WHEN fee.value ? 'inputImpactCurrencyId'
                AND fee.value ? 'inputImpactMinor'
                THEN fee.value
              ELSE fee.value || jsonb_build_object(
                'inputImpactCurrencyId',
                fee.value -> 'currencyId',
                'inputImpactMinor',
                fee.value -> 'amountMinor'
              )
            END
            ORDER BY fee.ordinality
          )
          FROM jsonb_array_elements(
            COALESCE(last_calculation -> 'additionalFees', '[]'::jsonb)
          ) WITH ORDINALITY AS fee(value, ordinality)
        ),
        '[]'::jsonb
      ),
      true
    ) AS next_last_calculation
  FROM payment_route_templates
  WHERE last_calculation IS NOT NULL
)
UPDATE payment_route_templates AS template
SET last_calculation = normalized.next_last_calculation
FROM normalized
WHERE template.id = normalized.id
  AND template.last_calculation IS DISTINCT FROM normalized.next_last_calculation;
