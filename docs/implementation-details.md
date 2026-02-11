# Implementation Details

Last updated: 2026-02-10

This document describes implementation specifics as they exist today in code.

## `@bedrock/kernel`

Key files:

- `packages/kernel/src/error.ts`
- `packages/kernel/src/logger.ts`
- `packages/kernel/src/canon.ts`
- `packages/kernel/src/currency.ts`
- `packages/kernel/src/crypto.ts`
- `packages/kernel/src/constants.ts`

Details:

- `AppError` is the shared application error shape with `code`.
- `createConsoleLogger` wraps `pino`; `noopLogger` is default silent logger.
- `stableStringify` deterministically serializes objects for hashing and key creation.
- `makePlanKey(operation, payload)` creates canonical plan keys.
- `normalizeCurrency` enforces `^[A-Z0-9_]{2,16}$`.
- `TransferCodes` defines domain transfer code map:
  - `FUNDING_SETTLED=1001`
  - `FX_*` codes in 2000 range
  - `PAYOUT_INITIATED=3001`
  - `INTERNAL_TRANSFER=4001`

## `@bedrock/db`

### Client and schema export

- `db` is `drizzle(pool, { schema })`.
- `schema` aggregates ledger, treasury, fx, and transfers tables.
- DB connection is environment-driven with fallback localhost values.

### Ledger schema

- `journal_entries`
  - Unique: `(org_id, idempotency_key)`
  - Contains `plan_fingerprint`, posting status, error, observability counters
- `journal_lines`
  - Unique: `(entry_id, line_no)`
  - Stores derived debit/credit lines for create plans
- `tb_transfer_plans`
  - Stores normalized TB transfer instructions
  - Unique: `(journal_entry_id, idx)` and `(org_id, transfer_id)`
  - Check constraints enforce non-negative amount and type-specific requirements
- `outbox`
  - Unique: `(kind, ref_id)`
  - Lease/retry fields: `status`, `attempts`, `locked_at`, `available_at`
- `ledger_accounts`
  - Unique deterministic account mapping `(org_id, tb_ledger, key)`
  - `tb_account_id` stored via custom `uint128` numeric type

### Treasury schema

- `payment_orders` stores lifecycle state and expected settlement values.
- Includes:
  - `ledger_entry_id` pointer for current pending-posting transition
  - `payout_pending_transfer_id` for pending payout settlement/voiding
  - idempotency uniqueness per `(treasury_org_id, idempotency_key)`
- `settlements` records settlement events by kind.

### FX schema

- `fx_policies`: margin/fee/ttl parameters and active flag.
- `fx_rates`: timestamped rate observations.
- `fx_quotes`: quote snapshot with status lifecycle and idempotency key.

### Transfers schema

- `internal_transfers` implements maker/checker workflow and ledger link.
- Unique `(org_id, idempotency_key)` for draft creation idempotency.

## `@bedrock/ledger`

### Engine: journal intent creation

`createLedgerEngine(...).createEntryTx(tx, input)`:

1. Validate input and chain-block adjacency.
2. Compute deterministic `planFingerprint`.
3. Insert `journal_entries` with `onConflictDoNothing`.
4. On conflict, fetch existing row and compare fingerprint.
5. Derive `journal_lines` for each `PlanType.CREATE`.
6. Build `tb_transfer_plans` rows:
   - Compute `tbLedgerForCurrency`.
   - Compute deterministic `transferId` by plan.
   - Set `isLinked` flags from adjacent shared `chain`.
7. Insert outbox `post_journal` job.
8. Return `{ entryId, transferIds }`.

### Deterministic IDs

- `tbLedgerForCurrency(currency)` -> `u32` hash.
- `tbAccountIdFor(orgId,key,tbLedger)` -> `u128` hash.
- `tbTransferIdForPlan(orgId,entryId,idx,planKey)` -> `u128` hash.

### TB integration

- `makeTbAccount` and `makeTbTransfer` map internal shape to TB API shape.
- `tbCreateAccountsOrThrow` treats `exists` as success.
- `tbCreateTransfersOrThrow` treats `exists` as success.
- Hard errors throw `TigerBeetleBatchError`.

### Account resolution and self-healing

`resolveTbAccountId`:

- Deterministically computes expected TB account id.
- Reads existing mapping from `ledger_accounts`.
- If mapping exists and matches deterministic id:
  - idempotently calls TB `createAccounts` to self-heal missing TB account cases.
- If mapping does not exist:
  - inserts mapping first with `onConflictDoNothing`.
  - creates TB account when winning insert race.
  - refetches on conflict and validates deterministic id.

### Ledger worker

`createLedgerWorker(...).processOnce`:

- Claims outbox jobs with SQL CTE + lease semantics.
- For each job:
  - Executes `postJournal` to create TB transfers.
  - Updates outbox/journal statuses atomically.
  - Uses retryability classifier and exponential backoff.
- Terminal failure marks outbox, transfer plans, and journal failed.

`postJournal`:

- Loads `tb_transfer_plans` in idx order.
- Resolves account keys to TB account ids with in-memory cache.
- Builds TB transfers for:
  - `create`
  - `post_pending` (`amount=0` means full post using `TB_AMOUNT_MAX`)
  - `void_pending`
- Posts to TigerBeetle.
- Marks plans and journal posted.

## `@bedrock/treasury`

### Keyspace

`treasuryKeyspace` keys include:

- `customerWallet`
- `bank`
- `treasuryPool`
- `intercompanyNet`
- `orderPayIn`
- `payoutObligation`
- `revenueFee`
- `revenueSpread`

### Service lifecycle methods

`createTreasuryService`:

- `fundingSettled`
  - Validates order identity, currency, amount, customer, branch org
  - Creates ledger entry
  - CAS-transition to `funding_settled_pending_posting`
  - Idempotent path requires matching `ledgerEntryId`
- `executeFx`
  - Validates order currencies, amounts, customer, branch org
  - Builds multi-leg FX journal with `chain=fx:<quoteRef>`
  - CAS-transition to `fx_executed_pending_posting`
- `initiatePayout`
  - Creates pending transfer from payout obligation to destination bank account
  - Saves deterministic pending transfer id to order
  - CAS-transition to `payout_initiated_pending_posting`
- `settlePayout`
  - Posts pending payout transfer by `pendingId`
  - CAS-transition to `closed_pending_posting`
- `voidPayout`
  - Voids pending payout transfer by `pendingId`
  - CAS-transition to `failed_pending_posting`

### Treasury worker

`createTreasuryWorker(...).processOnce`:

- Reads orders with `*_pending_posting` status and linked journal.
- Locks each row (`FOR UPDATE SKIP LOCKED`) in transaction.
- Finalizes:
  - pending status -> terminal business status when journal is `posted`
  - pending status -> `failed` when journal is `failed`
- Returns count of actually finalized rows.

## `@bedrock/fx`

### Service

`createFxService` methods:

- `upsertPolicy` (current implementation inserts new policy row)
- `setManualRate`
- `getLatestRate`
- `getCrossRate`:
  - direct pair
  - inverse pair
  - anchor path (default USD)
- `quote`:
  - idempotent by `idempotencyKey`
  - computes `toAmountMinor`, fee and spread using policy bps
  - stores quote with TTL-based `expiresAt`
- `markQuoteUsed`:
  - marks active quote used if not expired
- `expireOldQuotes`:
  - bulk expires active quotes older than cutoff

### Validation and errors

- Zod-based input validation for each method.
- Explicit errors:
  - `RateNotFoundError`
  - `PolicyNotFoundError`
  - `QuoteExpiredError`
  - `NotFoundError`
  - `ValidationError`

## `@bedrock/transfers`

### Keyspace

`transfersKeyspace` defines:

- `customerWallet(customerId,currency)`
- `internal(orgId,name,currency)`

### Service

`createTransfersService`:

- `createDraft`
  - inserts `internal_transfers` draft with idempotency
- `approve`
  - optional `canApprove` callback check
  - validates draft state
  - creates ledger entry
  - CAS-transition to `approved_pending_posting`
- `reject`
  - optional `canApprove` callback check
  - CAS-transition draft -> rejected
- `markFailed`
  - operational transition from pending posting to failed

### Transfers worker

`createTransfersWorker(...).processOnce`:

- Selects transfers in `approved_pending_posting` with joined journal status.
- Marks transfer `posted` when journal `posted`.
- Marks transfer `failed` when journal `failed`.
- Logs `found` and `processed`.
- Returns `processed` count (actual finalized items).

## `@bedrock/test-utils`

Shared test helpers:

- Deterministic UUID/date/currency fixtures.
- Drizzle mock-db and stub-db builders.
- Chain-friendly mocks for `select/insert/update/execute`.
- Utility functions for wiring transaction behavior in tests.

## `@bedrock/ui`

Current UI package is a simple shared component set:

- `Button`
- `Card`
- `Code`

It is scaffold-level and not part of the financial domain runtime.

## Config Packages

### `@bedrock/eslint-config`

Exports shared lint presets:

- `./base`
- `./next-js`
- `./react-internal`

### `@bedrock/typescript-config`

Holds reusable TS config package metadata for monorepo package inheritance.

