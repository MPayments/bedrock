# @bedrock/treasury

Application module for payment-order orchestration on top of `@bedrock/ledger`.

## Main responsibilities

- Payment order state-machine transitions
- Funding, FX, payout, and fee-payment command handling
- Idempotent creation of ledger operations per business event
- Worker-based finalization from pending-posting states

## Service operations

- `fundingSettled`
- `executeFx`
- `initiatePayout`
- `settlePayout`
- `voidPayout`
- `initiateFeePayment`
- `settleFeePayment`
- `voidFeePayment`

## Workers

- `createTreasuryWorker(...).processOnce(...)`
- `createTreasuryReconciliationWorker(...).processOnce(...)`

## Exports

- `createTreasuryService`
- `createTreasuryWorker`
- `createTreasuryReconciliationWorker`
- Treasury validation schemas/types
- Treasury domain errors

## Scripts

- `bun run build`
- `bun run dev`
- `bun run check-types`
