# @bedrock/transfers

Application module for maker-checker transfer orders.

## Main responsibilities

- Draft creation and query/list APIs
- Approval/rejection flow with maker-checker checks
- Pending transfer settle/void commands
- Idempotent status transitions around ledger posting lifecycle

## Service operations

- `createDraft`
- `approve`
- `reject`
- `settlePending`
- `voidPending`
- `list`
- `get`

## Worker behavior

- `createTransfersWorker(...).processOnce(...)`
- Finalizes orders from `*_pending_posting` states using linked `ledger_operations.status`

## Exports

- `createTransfersService`
- `createTransfersWorker`
- Validation schemas/types
- Transfer domain errors

## Scripts

- `bun run build`
- `bun run dev`
- `bun run check-types`
