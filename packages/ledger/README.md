# @bedrock/ledger

Ledger intent and posting engine built around Postgres + TigerBeetle.

## Main responsibilities

- Validate and persist ledger operations (`createOperationTx` / `createOperation`)
- Build deterministic TB transfer plans
- Generate deterministic TB IDs
- Resolve book accounts to TB accounts
- Post plans asynchronously via outbox worker

## Key modules

- `src/engine.ts`:
  - Input validation and chain validation
  - Ledger operation insert with idempotency fingerprint checks
  - Posting line derivation
  - TB plan and outbox creation
- `src/worker.ts`:
  - Outbox claiming with lease + retry
  - TB transfer execution and status finalization
- `src/resolve.ts`:
  - Deterministic `book_accounts` mapping
  - TB account self-healing on retries
- `src/ids.ts`:
  - Hash-based deterministic IDs for ledgers/accounts/transfers
- `src/tb.ts`:
  - TB client wrappers and error normalization

## Exported API

- `createLedgerEngine`
- `createLedgerWorker`
- `OPERATION_TRANSFER_TYPE`
- `CreateOperationResult`
- `IdempotencyConflictError`

## Posting model

- Synchronous phase writes:
  - `ledger_operations`
  - `ledger_postings`
  - `tb_transfer_plans`
  - `outbox`
- Asynchronous worker posts to TigerBeetle and finalizes plan/operation status.

## Scripts

- `npm run build`
- `npm run dev`
- `npm run check-types`
- Tests run from repo root: `npm run test`, `npm run test:integration`, `npm run test:all`
