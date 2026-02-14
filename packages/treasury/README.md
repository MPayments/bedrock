# @bedrock/treasury

Treasury payment-order orchestration and finalization workers.

## Main responsibilities

- Payment order state machine transitions
- Order-level business validation for funding/FX/payout stages
- Ledger entry generation for each stage via `@bedrock/ledger`
- Unified fee transfer generation via `@bedrock/fees`
- Worker-driven finalization from `*_pending_posting` states

## Service operations

- `fundingSettled`
- `executeFx`
- `initiatePayout`
- `settlePayout`
- `voidPayout`

Each operation:

- Validates input and order invariants
- Creates one journal entry (idempotent key per operation family)
- Performs CAS status transition on `payment_orders`

## Worker

- `createTreasuryWorker(...).processOnce(...)`
- Finalizes order status by linked `journal_entries.status`
- Uses row locking to avoid concurrent double-finalization

## Keyspace

`treasuryKeyspace` provides account key builders for:

- Customer wallet
- Bank account
- Treasury pool
- Intercompany net
- Order pay-in
- Payout obligation
- Revenue accounts (fee/spread)
- Fee buckets and fee-clearing accounts

## Exports

- `createTreasuryService`
- `createTreasuryWorker`
- `treasuryKeyspace`
- Validation schemas/types
- Error classes

## Scripts

- `npm run build`
- `npm run dev`
- `npm run check-types`
- Tests run from repo root: `npm run test`, `npm run test:integration`, `npm run test:all`
