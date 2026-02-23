# @bedrock/transfers

Internal transfer maker/checker domain service plus posting finalization worker.

## Main responsibilities

- Draft creation with idempotency
- Checker approval/rejection flow
- Ledger entry creation for approved transfers
- Status finalization based on journal posting status

## Service operations

- `createDraft`
- `approve`
- `reject`
- `markFailed`

## Worker behavior

- `createTransfersWorker(...).processOnce(...)`
- Selects transfers in `approved_pending_posting`
- Reads linked journal status and finalizes to:
  - `posted` when journal is `posted`
  - `failed` when journal is `failed`
- Returns count of actually processed/finalized items

## Keyspace

`transfersKeyspace` currently defines:

- `customerWallet(customerId, currency)`
- `internal(counterpartyId, name, currency)`

## Exports

- `createTransfersService`
- `createTransfersWorker`
- `transfersKeyspace`
- Validation schemas/types
- Transfer error classes

## Scripts

- `npm run build`
- `npm run dev`
- `npm run check-types`
- Tests run from repo root: `npm run test`
