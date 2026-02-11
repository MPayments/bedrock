# @bedrock/ledger

Ledger intent and posting engine built around Postgres + TigerBeetle.

## Main responsibilities

- Validate and persist journal intent (`createEntryTx` / `createEntry`)
- Build deterministic TB transfer plans
- Generate deterministic TB IDs
- Resolve account keys to TB accounts
- Post plans asynchronously via outbox worker

## Key modules

- `src/engine.ts`:
  - Input validation and chain validation
  - Journal entry insert with idempotency fingerprint checks
  - Journal line derivation
  - TB plan and outbox creation
- `src/worker.ts`:
  - Outbox claiming with lease + retry
  - TB transfer execution and status finalization
- `src/resolve.ts`:
  - Deterministic `ledger_accounts` mapping
  - TB account self-healing on retries
- `src/ids.ts`:
  - Hash-based deterministic IDs for ledgers/accounts/transfers
- `src/tb.ts`:
  - TB client wrappers and error normalization

## Exported API

- `createLedgerEngine`
- `createLedgerWorker`
- `PlanType`
- `CreateEntryResult`
- `defineKeyspace`
- `IdempotencyConflictError`

## Posting model

- Synchronous phase writes:
  - `journal_entries`
  - `journal_lines`
  - `tb_transfer_plans`
  - `outbox`
- Asynchronous worker posts to TigerBeetle and finalizes plan/journal status.

## Scripts

- `npm run build`
- `npm run dev`
- `npm run check-types`
- Tests run from repo root: `npm run test`, `npm run test:integration`, `npm run test:all`
