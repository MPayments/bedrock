# Implementation Details

Last updated: 2026-02-28

This document captures implementation specifics as they exist in the current codebase.

## Naming note

Current ledger naming is operation-centric:

- `ledger_operations` / `postings`
- `commit`
- outbox kind `post_operation`

Legacy terms like `journal_entries`, `journal_lines`, or `createEntryTx` are not the current implementation.

## `@bedrock/kernel`

Key files:

- `packages/platform/kernel/src/error.ts`
- `packages/platform/kernel/src/errors.ts`
- `packages/platform/kernel/src/logger.ts`
- `packages/platform/kernel/src/canon.ts`
- `packages/platform/kernel/src/currency.ts`
- `packages/platform/kernel/src/constants.ts`

Current behavior:

- `AppError` is transport-facing error with `code`.
- `ServiceError` hierarchy (`ValidationError`, `InvalidStateError`, `NotFoundError`, etc.) is used in domain packages.
- `stableStringify` and `makePlanKey` provide deterministic serialization/plan keys.
- `normalizeCurrency` enforces `^[A-Z0-9_]{2,16}$`.
- `TransferCodes` includes funding, FX, fee, payout, and internal-transfer codes (including `300x` fee family and `PAYOUT_INITIATED=3101`).

## `@bedrock/db`

### Client

- `db = drizzle(pool, { schema })`
- connection uses env-driven host/port/db/user/password with localhost fallbacks

### Ledger schema

- `ledger_operations`
  - unique: `idempotency_key`
  - fields: source (`source_type`, `source_id`), operation code/version, `payload_hash`, posting status/error metadata
- `postings`
  - unique: `(operation_id, line_no)`
  - debit/credit `book_account_instance` references + analytics columns
- `tb_transfer_plans`
  - unique: `(operation_id, line_no)` and global `transfer_id`
  - supports `create`, `post_pending`, `void_pending`
- `outbox`
  - unique: `(kind, ref_id)`
  - lease and retry columns
- `book_account_instances`
  - unique deterministic mapping by `(book_org_id, account_no, currency, dimensions_hash)` and `(book_org_id, tb_ledger, tb_account_id)`

### Accounting schema

- `chart_template_accounts`
- `chart_account_dimension_policy`
- `correspondence_rules`
- `operational_account_bindings`

### Treasury schema

- `payment_orders` with `ledger_operation_id` and `payout_pending_transfer_id`
- `settlements`
- `fee_payment_orders` (reserve/initiate/resolve operation links + pending transfer)
- `reconciliation_exceptions`
- `counterparties`, `counterparty_groups`, `counterparty_group_memberships`
- `operational_accounts`, `operational_account_providers`

### Transfers schema

- `transfer_orders`
  - statuses include `pending`, `settle_pending_posting`, `void_pending_posting`, `voided`
  - supports pending transfer IDs for source/destination
- `transfer_events`
  - idempotent settle/void events

### FX and fees schema

- `fx_rates`, `fx_rate_sources`
- `fx_quotes`, `fx_quote_legs`
- `fee_rules`, `fx_quote_fee_components`

## `@bedrock/accounting`

Key files:

- `packages/platform/accounting/src/constants.ts`
- `packages/platform/accounting/src/templates.ts`
- `packages/platform/accounting/src/service.ts`

Current behavior:

- Defines CoA account constants (`ACCOUNT_NO`), operation codes, posting codes, and required analytics by posting code.
- Provides template builders for transfers:
  - `buildTransferApproveTemplate`
  - `buildTransferPendingActionTemplate`
- Cross-org transfer templates route via `1310 INTERCOMPANY_NET`.
- Fee template resolvers map fee/spread/adjustment/provider-expense behaviors to posting shapes.
- `createAccountingService` supports correspondence management and posting matrix validation.

## `@bedrock/accounting-reporting`

Key files:

- `packages/modules/accounting-reporting/src/service.ts`
- `packages/modules/accounting-reporting/src/validation.ts`

Current behavior:

- Provides financial-results aggregation views:
  - `listFinancialResultsByCounterparty`
  - `listFinancialResultsByGroup`
- Owns financial-results query contracts/schemas used by API routes.

## `@bedrock/operational-accounts`

Key files:

- `packages/modules/operational-accounts/src/commands/create-account.ts`
- `packages/modules/operational-accounts/src/commands/resolve-transfer-bindings.ts`
- `packages/platform/ledger/src/book-accounts.ts`

Current behavior:

- Creates `operational_accounts` and validates provider-specific fields.
- Requires `postingAccountNo` on account creation path and ensures/creates matching `book_account_instance`.
- Persists OA->book binding in `operational_account_bindings`.
- `resolveTransferBindings` returns binding metadata used by transfers:
  - counterparty
  - currency
  - bound book account
  - `bookOrgId` (currently counterparty-based)

## `@bedrock/ledger`

### Engine

`createLedgerEngine(...).commit(tx, input)`:

1. Validates operation input and contiguous chain blocks.
2. Computes deterministic `payloadHash` from operation code/version, payload, and normalized transfer lines.
3. Inserts `ledger_operations` idempotently.
4. On idempotent replay, checks matching `payloadHash`.
5. For each `create` transfer line:

- validates `correspondence_rules`
- validates chart account policy (`posting_allowed`, `enabled`)
- validates required analytics (account-level + posting-code-level)
- ensures deterministic `book_account_instances`

6. Writes `postings` (for create lines).
7. Writes `tb_transfer_plans` (all lines).
8. Enqueues `outbox(kind='post_operation')`.
9. Returns `{ operationId, pendingTransferIdsByRef }`.

### Deterministic IDs

- `tbLedgerForCurrency(currency)` -> u32 hash
- `tbBookAccountInstanceIdFor(bookOrgId, accountNo, currency, dimensionsHash, tbLedger)` -> u128 hash
- `tbTransferIdForOperation(operationId, lineNo, planRef)` -> u128 hash

### TB integration and worker

- `tbCreateAccountsOrThrow` and `tbCreateTransfersOrThrow` treat TB `exists` as success.
- `createLedgerWorker(...).processOnce`:
  - claims outbox jobs with lease semantics
  - executes posting
  - retries retryable failures with exponential backoff
  - marks terminal failures in outbox, tb plans, and operations
- Posting supports:
  - `create`
  - `post_pending` (`amount=0` means full post via `TB_AMOUNT_MAX`)
  - `void_pending`

### Account resolution helper

`resolveTbBookAccountId` ensures deterministic mapping in `book_account_instances` and idempotent TB account creation.

## `@bedrock/treasury`

### Service surface

`createTreasuryService` composes command handlers and currently exposes:

- `fundingSettled`
- `executeFx`
- `initiatePayout`
- `settlePayout`
- `voidPayout`
- `initiateFeePayment`
- `settleFeePayment`
- `voidFeePayment`

### Payment order lifecycle integration

- Commands validate order identity/currency/amount/customer/counterparty invariants.
- Commands call `ledger.commit` and perform CAS transitions to pending-posting states.
- Idempotency checks are transition-aware and tied to `ledgerOperationId`.

### Worker behavior

`createTreasuryWorker(...).processOnce` finalizes:

- `payment_orders` pending-posting statuses based on linked `ledger_operations.status`
- `fee_payment_orders` pending-posting statuses based on linked initiate/resolve operation status

### Reconciliation worker

`createTreasuryReconciliationWorker(...).processOnce` scans for invariant violations (stuck pending, missing journal links, plan mismatch, settlement/order mismatch) and manages `reconciliation_exceptions` state.

## `@bedrock/fx`

### Service surface

`createFxService` composes rates + quote handlers.

Rates:

- `setManualRate`
- `getLatestRate`
- `getCrossRate`
- `listPairs`
- `getRateSourceStatuses`
- `syncRatesFromSource`
- `expireOldQuotes`

Quotes:

- `quote`
- `getQuoteDetails`
- `markQuoteUsed`

### Current quote implementation

- Supports `auto_cross` and `explicit_route` pricing modes.
- Persists:
  - quote header in `fx_quotes`
  - route legs in `fx_quote_legs`
  - fee snapshot in `fx_quote_fee_components` (via fees service)
- Quote creation is idempotent by `idempotencyKey`.

### Rate source behavior

- Source sync/status logic is in `commands/rates/source-sync.ts`.
- Source statuses are stored in `fx_rate_sources`.
- Current sources include `cbr` and `investing` with source-specific TTL behavior.

### Worker

`createFxRatesWorker` periodically syncs configured sources and expires old quotes.

## `@bedrock/fees`

`createFeesService` provides:

- rule upsert/query/resolve
- FX quote fee component calculation
- quote component persistence and retrieval
- fee/adjustment merge and partition helpers
- transfer-plan helper functions used by treasury execution flows

## `@bedrock/transfers`

### Service surface

`createTransfersService` currently provides:

- `createDraft`
- `approve`
- `reject`
- `settlePending`
- `voidPending`
- `get`
- `list`

### Behavior

- Maker/checker enforcement with optional authorization callback.
- Draft creation is idempotent by `(sourceCounterpartyId, idempotencyKey)`.
- Approve creates operation + CAS move to `approved_pending_posting`.
- Pending settle/void use `transfer_events` for event-level idempotency.
- Cross/intra posting templates are provided by `@bedrock/accounting` templates.

### Worker

`createTransfersWorker(...).processOnce` finalizes transfer states by linked ledger status:

- posted path:
  - `approved_pending_posting -> posted` (immediate)
  - `approved_pending_posting -> pending` (pending settlement mode)
  - `settle_pending_posting -> posted`
  - `void_pending_posting -> voided`
- failed path:
  - any claimable pending-posting state -> `failed`

## Apps

### `apps/api`

Current composition root wires:

- accounting/account providers/operational-accounts
- counterparties/groups
- customers
- currencies
- FX rates
- treasury
- transfers
- ledger read service

Application modules are mounted via `apps/api/src/modules/registry.ts`.

Worker loops are composed in `apps/workers/src/modules/registry.ts`.

### `apps/web`

The web app is not a default scaffold. It contains active product pages for accounting, FX, treasury entities, operations, and transfers.

## Accounting model summary (implementation alignment)

- `Counterparty` is the ownership/reporting subject.
- `OperationalAccount` is a single-currency external endpoint.
- `OperationalAccount` is bound to a `BookAccountInstance` via `operational_account_bindings`.
- `BookAccountInstance` is the internal ledger place (book org + account + currency + dimensions hash) mapped deterministically to TB.
- `ledger.commit` is the single write gate for operation + postings + TB plan + outbox, including correspondence and analytics enforcement.
