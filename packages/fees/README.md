# @bedrock/fees

Unified fee-domain package.

## Main responsibilities

- Common fee component model across FX/bank/blockchain/manual fees
- Persisted fee rules (`fee_rules`) resolution
- FX quote fee snapshot persistence (`fx_quote_fee_components`)
- Fee component merge/aggregation
- Fee transfer plan builder for ledger posting

## Service API

- `createFeesService()` returns:
  - `upsertRule`
  - `listApplicableRules`
  - `calculateBpsAmount`
  - `calculateFxQuoteFeeComponents`
  - `saveQuoteFeeComponents`
  - `getQuoteFeeComponents`
  - `mergeFeeComponents`
  - `aggregateFeeComponents`
  - `partitionFeeComponents`
  - `buildFeeTransferPlans`
  - `mergeAdjustmentComponents`
  - `aggregateAdjustmentComponents`
  - `partitionAdjustmentComponents`
  - `buildAdjustmentTransferPlans`

## Exports

- Fee types
- Validation schemas/types
- Fee service helpers
- Fee error classes
