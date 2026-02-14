# @bedrock/fx

FX policy, rate, and quote service package.

## Main responsibilities

- Manage FX pricing policies
- Store and retrieve rates
- Produce quotes with margin/fee logic
- Delegate fee component calculation to `@bedrock/fees`
  - fee rules are resolved from persisted `fee_rules`
- Mark quotes as used
- Expire old quotes

## Service API

- `upsertPolicy` (upsert key: `name`)
- `setManualRate`
- `getLatestRate`
- `getCrossRate`
- `quote`
  - uses `@bedrock/fees` for fee/spread component calculation
  - persists resolved fee snapshot to `fx_quote_fee_components`
- `markQuoteUsed`
- `expireOldQuotes`

## Rate model

- Supports:
  - direct pair lookup
  - inverse pair lookup
  - anchor cross-rate path (default anchor: `USD`)

## Quote model

- Idempotent by `idempotencyKey`
- Persists:
  - input/output amounts
  - fee and spread
  - rate numerator/denominator
  - TTL-based expiration
  - quote status lifecycle

## Exports

- `createFxService`
- Validation schemas/types
- FX error classes

## Scripts

- `npm run build`
- `npm run dev`
- `npm run check-types`
