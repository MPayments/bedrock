# @bedrock/ledger

Ledger write/read core on top of Postgres + TigerBeetle.

## Main responsibilities

- Validate and persist operations via `ledger.commit(...)`
- Enforce correspondence and dimension policies before write
- Build deterministic TigerBeetle transfer plans
- Persist outbox jobs for async posting
- Expose read queries for operations, operation details, and OA balances

## Key modules

- `src/commands/commit.ts`: write gate (`ledger_operations`, `postings`, `tb_transfer_plans`, `outbox`)
- `src/internal/commit/*`: idempotency, dimension policy, TB plan building
- `src/queries/read.ts`: read-side queries + dimension label resolution
- `src/worker.ts`: outbox claiming, TigerBeetle posting, finalization
- `src/resolve.ts`: deterministic book-account-instance to TB account resolution

## Exported API

- `createLedgerEngine`
- `createLedgerReadService`
- `createLedgerWorker`
- `ListLedgerOperationsQuerySchema`
- `OPERATION_TRANSFER_TYPE`
- `IdempotencyConflictError`
- `AccountingNotInitializedError`

## Scripts

- `bun run build`
- `bun run dev`
- `bun run check-types`
