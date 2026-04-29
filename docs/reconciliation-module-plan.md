# Reconciliation Module — Implementation Plan

Status: design draft, deep-research-validated, **not implemented**.
Audience: another agent or developer who will implement this phase by phase.
Repo baseline: branch `main` at the time of writing (`docs/history/claude-md.md` tracks future refresh).

> Conventions referenced throughout: `AGENTS.md`, `CLAUDE.md`, `docs/adr/0001-bounded-context-explicit-architecture.md`. Bedrock is a Turborepo monorepo on Bun + Node 24 + TypeScript 5.8 + Drizzle ORM + PostgreSQL + TigerBeetle + Hono + Pino + Vitest. Packages export only via `package.json#exports`. All money is `bigint` minor units. Service factories are closures, not classes.

> **Revision history.** v1 was an initial walkthrough. v2 (this document) folded in a deep-research pass that verified every cited file path against the codebase, fact-checked provider taxonomies (Stripe `BalanceTransaction`, Adyen Settlement Details, Wise statements), and replaced the additive confidence-scoring formula with a conditional pipeline. Major v2 additions: provider balance snapshots (§2.4a), typed-column denormalization rule (§2.4c), value-date vs booking-date policy (§3.2), holiday-aware settlement windows (§3.3), shadow-ledger / tri-balance check (§3.4), multi-hop transitive matching (§3.5), conditional confidence scoring (§5.4), GAAP/SOX/PCI handling (§14), and an explicit `§1.12 Platform integration shapes` section that anchors every new handler to the existing idempotency / transactions / OpenAPI / file-upload / pending-sources contracts.

---

## 0. Executive summary

Bedrock already ships a `@bedrock/reconciliation` module (`packages/modules/reconciliation/`) and a `@bedrock/workflow-reconciliation-adjustments` workflow (`packages/workflows/reconciliation-adjustments/`). They cover an internal `ledger ↔ documents ↔ treasury` matching loop driven by a generic `reconciliationExternalRecords` ingest. Today the module is wired into deal-scoped routes only (`apps/api/src/routes/deals.ts`) and is exercised by the `reconciliation` worker (`apps/workers/src/catalog.ts:6`).

What is **missing** is the outer half of the reconciliation triangle:

1. **Provider integrations** — no Stripe, Adyen, Wise, or any PSP code exists in the repo (`grep -ri stripe|adyen|wise` returns 0 hits). MISSING.
2. **Webhook receivers** — there is no `webhooks` route folder under `apps/api/src/routes`. MISSING.
3. **Raw provider reports** as immutable artefacts (file + parsed rows linked to the file). MISSING.
4. **Bank statements / bank documents** as a domain (opening / closing balances, `bank_credit` / `bank_debit` entries, statement-level provenance). MISSING.
5. **Canonical movement model** that uniformly represents Stripe `BalanceTransactions`, Adyen settlement rows, Wise statement movements, and bank statement entries. MISSING. The existing `reconciliationExternalRecords.normalizedPayload` is a free-form `jsonb` blob — there is no shared schema for it.
6. **Expected vs actual** semantics. The module today says "this `treasury_instruction_outcome` matches that `paymentStep`" by candidate IDs only; there is no amount / currency / date / fee tolerance comparison and no notion of an *expected* provider fee or *expected* settled amount.
7. **Confidence scoring & tolerance rules**. Only `matched | unmatched | ambiguous` exists; no scoring, no tolerance config.
8. **Treasury queue UI**. The only UI is `apps/finance/features/treasury/deals/components/execution/reconciliation-section.tsx` (deal-scoped). MISSING: a global unresolved-exceptions queue for treasury / admins.
9. **Richer exception taxonomy**, **manual review states** (`in_review`, `escalated`), and **resolution reason codes**. Only `state: open|resolved|ignored` and a free-form `reasonCode` exist today.
10. **Scheduled period runs** — runs are triggered on-demand per deal. There is no daily / per-provider / per-bank-account scheduled run.

This plan **evolves** the existing module rather than rewriting it, and adds three sibling concerns:

* **Provider integrations** as new packages (`@bedrock/provider-stripe`, `@bedrock/provider-adyen`, `@bedrock/provider-wise`) producing canonical movements.
* **Bank statements** as a domain co-owned by reconciliation (`@bedrock/reconciliation` extended) or a sibling `@bedrock/bank-statements` package — see NEEDS_DECISION below.
* **Reconciliation queue API + UI** at the global level for treasury users.

---

## 1. Current architecture analysis

All paths are repo-relative.

### 1.1 Existing reconciliation module

Path: `packages/modules/reconciliation/`. Layout follows AGENTS.md root-layered shape.

* `src/index.ts`, `src/service.ts` — facade `createReconciliationService`.
* `src/contracts/{commands,queries,dto,index}.ts` — Zod schemas + DTOs.
* `src/domain/{reconciliation-run, external-record, reconciliation-exception, candidate-references, matching, idempotency, exceptions}.ts` — pure domain.
* `src/application/shared/{context, external-ports}.ts` — context factory and ports for documents / ledger / treasury / transactions.
* `src/application/{records,runs,exceptions,links}/...` — handlers.
* `src/infra/drizzle/schema/index.ts` — tables (see §2).
* `src/infra/drizzle/repos/{external-records,runs,matches,exceptions}-repo.ts`.
* `src/infra/drizzle/query-support/pending-sources.ts` — finds sources with unmatched records.
* `src/infra/workers/reconciliation-worker.ts` — polling worker.

Public exports (from `package.json#exports`): `.`, `./contracts`, `./schema`, `./worker`.

Existing tables (see `src/infra/drizzle/schema/index.ts`):

* `reconciliationExternalRecords` (id, source, sourceRecordId, rawPayload jsonb, normalizedPayload jsonb, payloadHash, normalizationVersion, request/correlation/trace/causation IDs, receivedAt). Unique `(source, sourceRecordId)`. Index `(source, receivedAt)`.
* `reconciliationRuns` (id, source, rulesetChecksum, inputQuery jsonb, resultSummary jsonb, request context, createdAt). Index `(source, createdAt)`.
* `reconciliationMatches` (id, runId, externalRecordId, matchedOperationId → `ledger.ledgerOperations`, matchedTreasuryOperationId → `treasury.paymentSteps`, matchedDocumentId → `documents`, status enum `matched|unmatched|ambiguous`, explanation jsonb, createdAt).
* `reconciliationExceptions` (id, runId, externalRecordId, adjustmentDocumentId → `documents`, reasonCode, reasonMeta jsonb, state enum `open|resolved|ignored`, createdAt, resolvedAt).

Today the only known `source` value used in code is `"treasury_instruction_outcomes"` (`apps/api/src/routes/deals.ts`). The `rulesetChecksum` defaults to `"core-default-v1"`.

### 1.2 Existing workflow

Path: `packages/workflows/reconciliation-adjustments/`. `createReconciliationAdjustmentsWorkflow` orchestrates "create adjustment document → resolve exception" via `documents` and `reconciliation` services.

### 1.3 Internal ledger / accounting / treasury / fees / fx (relevant facts)

* `packages/modules/ledger/` — `books`, `bookAccountInstances`, `ledgerOperations`, `postings`, `tbTransferPlans`, `balancePositions`, `balanceHolds`, `balanceEvents`, `balanceProjectorCursors`. All amounts `bigint amountMinor`. Maps to TigerBeetle. `ledgerOperations` is the **idempotent posting record** with `payloadHash`, `idempotencyKey`, `status`, `postedAt`, `postingDate`. **This is the canonical "internal ledger entry" that reconciliation matches against**.
* `packages/modules/accounting/` — chart of accounts, posting code policies, period locks, close packages. No money columns.
* `packages/modules/treasury/` — `treasuryOrders`, `treasuryOrderSteps`, `paymentSteps` (with `kind: payin|payout|intracompany_transfer|intercompany_funding|internal_transfer`, `state: draft|scheduled|pending|processing|completed|failed|returned|cancelled|skipped`), `paymentStepReturns`, `paymentStepArtifacts`, `paymentStepAttempts` (with `outcome: pending|settled|failed|voided|returned`), `fxQuotes`, `fxQuoteLegs`, `fxQuoteFeeComponents`, `fxRates`, `fxRateSources`, `feeRules`, `paymentRouteTemplates`, `quoteExecutions`. **`paymentSteps` is the operational "expected payment / payout / refund" entity** and `paymentStepReturns` is the operational refund/reversal entity. There is no separate `expected_payment` table — the `paymentSteps.state` machine is the expected-vs-actual story today.
* `packages/modules/calculations/` — already has a `provider_fee_expense` line kind (`/packages/modules/calculations/src/domain/constants.ts`). This is the existing "expected provider fee" data point.
* `packages/modules/fees/` — referenced by treasury `feeRules`. Fee settlement modes: `in_ledger` vs `separate_payment_order`.
* `packages/modules/fx/` — see `fxRates`, `fxRateSources` above. UNKNOWN whether any FX-difference reconciliation rule exists.
* `packages/modules/balances/` — UNKNOWN to this plan; balances live mostly under `ledger`. The `balances` module folder exists but its boundary vs. `ledger.balancePositions` should be clarified before scheduling balance-level reconciliation.

### 1.4 Documents and files

* `packages/modules/documents/` — `documents`, `documentEvents`, `documentLinks`, `documentOperations`. Documents are typed payload+lifecycle records (`draft → submitted → approved → posted`) referencing counterparty / customer / organizationRequisite. **Reconciliation already uses `documents` as the resolution surface** (adjustment documents).
* `packages/modules/files/` — `fileAssets`, `fileVersions` (with `storageKey`, `checksum`, `fileSize`, `mimeType` on `fileVersions`; `fileAssets` itself does not own storage columns), `fileLinks`. Adapter: `S3ObjectStorageAdapter` instantiated when `S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY` are set (`apps/workers/src/modules/registry.ts:131-147`); also reads `S3_BUCKET`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`. Files are **versioned**; the `checksum` column on `fileVersions` lets us implement content-addressed dedup at the application layer. **This is where raw bank statement and provider report files should land**. Existing file-upload route pattern: see `apps/api/src/routes/agreements.ts` (multipart `parseBody()` → `arrayBuffer()` → `filesModule.files.commands.*`) — reuse exactly.
* `packages/workflows/document-posting/` — `post`, `repost` handlers; the bridge from `documents` to `ledger.ledgerOperations`. Adjustment documents created via reconciliation flow through here.

### 1.5 Database, migrations, workers

* Migrations: drizzle-kit. Source `apps/db/src/drizzle-schema.ts` aggregates all module schemas via `apps/db/src/schema-registry.ts`. Output `apps/db/migrations/*.sql` (numbered, checked in). Cutover policy is **baseline-only** (`bun run db:nuke && bun run db:migrate && bun run db:seed`).
* Workers: custom polling fleet at `apps/workers/`. `apps/workers/src/catalog.ts` lists **7** workers — `ledger` (5s), `documents` (250ms), `documents-period-close` (60s), `balances` (5s), `treasury-rates` (60s), `reconciliation` (5s), `deal-attachment-ingestion` (15s). Runtime: `@bedrock/platform/worker-runtime` (interval-only — `BedrockWorker = { id, intervalMs, runOnce(ctx: { now, signal }): Promise<{ processed, blocked? }> }`). Idempotency: Postgres-backed service per worker.
* Cron / scheduled jobs: **the worker runtime exposes intervals only — there is no cron primitive**. Daily / monthly cadences must be implemented as a poller with an internal "should fire today" gate (see `apps/workers/src/modules/period-close.ts` precedent). The plan adopts this pattern instead of introducing a new cron component.

### 1.6 Webhooks, provider integrations, audit

* Webhooks: MISSING. No `webhooks` route directory in `apps/api/src/routes`.
* Provider integrations: MISSING. No Stripe / Adyen / Wise SDK or HTTP client code.
* Audit: a stub activity route exists at `apps/api/src/routes/activity.ts` (returns empty). MISSING: actual audit table or append-only event log usable for reconciliation actions. The `documentEvents` table (in `documents`) is a reasonable model to copy.

### 1.7 Money representation

Already perfect for reconciliation:

* `packages/shared/src/money/money.ts` — `bigint` minor units canonical. Helpers: `parseMinorAmount`, `toMinorAmountString`, `minorToAmountString`, `normalizeMajorAmountInput`, `resolveCurrencyPrecision` (Intl.NumberFormat).
* `packages/shared/src/money/math.ts` — `BPS_SCALE = 10000n`, `mulDivRoundHalfUp`. **Use these for tolerance arithmetic**.
* No floating point anywhere.

### 1.8 IAM and permissions

* Roles (`packages/modules/iam/src/domain/user-role.ts`): `admin`, `user`, `agent`, `customer`, `finance`.
* Permissions: enforced by `requirePermission(permissions: ResourcePermissions)` middleware (`apps/api/src/middleware/permission.ts:39-63`). The shape is `{ resource: ["action", ...] }` — every route key requires *all* listed actions. Existing reconciliation routes (`apps/api/src/routes/deals.ts:514-616`) double-key permissions: `{ deals: [...], reconciliation: [...] }`. New global routes (§7.2) drop the `deals:*` co-requirement. Existing reconciliation actions: `list`, `run`, `ignore`, `resolve`. New: `import`, `match`, `escalate`, `comment`, `export`.

### 1.9 API conventions

Hono + `@hono/zod-openapi`. Two patterns to follow:

* `registerIdempotentMutationRoute` (`apps/api/src/routes/internal/register-idempotent-mutation-route.ts`) — required for any state-changing endpoint; enforces `Idempotency-Key`, permission, error mapping, ETag where applicable.
* `OpenAPIHono` with `createRoute` for read endpoints (see `apps/api/src/routes/balances.ts`).
* Helpers: `jsonOk`, `handleRouteError`. All mutation responses go through these.

### 1.10 Testing

* `vitest.config.ts` — 27 unit projects.
* `vitest.integration.config.ts` — 9 integration projects (accounting, agreements, calculations, deals, documents, ledger, parties, reconciliation, treasury), `maxWorkers: 1`, requires running Postgres + TigerBeetle (`bun run infra:up`).
* Fixtures: `packages/tooling/test-utils/src/fixtures.ts`. Use `TEST_UUIDS`, `TEST_DATES`, `TEST_CURRENCIES`, `testUuid(seed)`.

### 1.11 Logging

`packages/platform/src/observability/logger.ts` — Pino, structured fields, `child(...)` pattern. Use the `svc: "reconciliation"` namespace and add `runId`, `source`, `externalRecordId`, `exceptionId`, `correlationId` to the structured payload.

### 1.12 Platform integration shapes the plan must use as-is

These are non-negotiable contracts that govern how new code wires into the existing module.

* **Idempotency port** — `packages/platform/src/idempotency/index.ts` exposes `withIdempotencyTx<TResult, TStoredResult>(input)` where `input = { scope, idempotencyKey, request, handler, serializeResult, loadReplayResult, serializeError }`. Handler runs inside an outer transaction; `serializeResult` / `loadReplayResult` allow opaque replay payloads. Reconciliation already defines scopes in `packages/modules/reconciliation/src/domain/idempotency.ts`: `recon.ingestExternalRecord`, `recon.run`, `recon.createAdjustmentDocument`. **Add new scopes** for new actions: `recon.ingestProviderReport`, `recon.ingestBankDocument`, `recon.normalizeProviderReport`, `recon.normalizeBankDocument`, `recon.manualMatch`, `recon.unmatch`, `recon.escalate`, `recon.assign`, `recon.export`.
* **Transactions port** — `ReconciliationTransactionsPort` in `packages/modules/reconciliation/src/application/shared/external-ports.ts` has shape `withTransaction<T>(run: (ctx: ReconciliationTransactionContext) => Promise<T>): Promise<T>`. Context bundles repos + idempotency. **Nested transactions are not supported** — design every handler around a single outer transaction. Heavy work (parsing, scoring) goes outside.
* **Advisory locks** — `packages/platform/src/persistence/postgres.ts` does **not** export an advisory-lock helper today. **Phase 7 must add** `packages/platform/src/persistence/advisory-lock.ts` with `withAdvisoryLock(db, lockKey: string, fn)` using `pg_try_advisory_xact_lock(hashtext($1))` for run-level concurrency control (§8.2).
* **Worker contract** — `BedrockWorker.runOnce({ now: Date, signal: AbortSignal }) → { processed: number, blocked?: number }`. The existing reconciliation worker also accepts a `beforeSource?: ReconciliationWorkerSourceGuard` hook (`{ source, externalRecordIds } → boolean`) — used to skip pre-emptively (e.g., when the deal scope says "not yet ready"). New direction-specific workers (§10) follow the same hook pattern.
* **`PendingSources` query** — `packages/modules/reconciliation/src/infra/drizzle/query-support/pending-sources.ts` returns `[{ source, externalRecordIds[], latestReceivedAt, pendingRecordCount }]` ordered by `latestReceivedAt ASC`. New incremental runs **must drive off this query** rather than scanning the whole table.
* **API style** — every route uses `OpenAPIHono` + `createRoute({ middleware, method, path, tags, request, responses })` + `app.openapi(route, handler)`. Mutations go through `registerIdempotentMutationRoute` (`apps/api/src/routes/internal/register-idempotent-mutation-route.ts`) which enforces `Idempotency-Key`, parses the body with Zod, runs the permission middleware, and centralizes error mapping via `handleRouteError`. Reads use `jsonOk(c, dto)` and may attach ETags. `/docs` autogenerates from these registrations.
* **Money DTO convention** — amounts cross the wire as decimal strings. Use `amountMinorSchema` / `signedMinorAmountSchema` from `@bedrock/shared/money/money.ts` in every Zod contract; deserialize with `BigInt(value)` and store as `bigint` columns. Never serialize as `number`.
* **File upload** — multipart form. Echo `apps/api/src/routes/agreements.ts:438-471` exactly: `const body = await c.req.parseBody(); const file = body.file;` → `Buffer.from(await file.arrayBuffer())` → `filesModule.files.commands.<command>({ buffer, fileName, fileSize, mimeType, uploadedBy })`. No signed-URL upload, no base64.
* **Existing facade methods** — `createReconciliationService(deps)` returns `{ records: { ingestExternalRecord }, runs: { runReconciliation }, exceptions: { ignore, listExceptions, explainMatch, getAdjustmentResolution, resolveWithAdjustment }, links: { listOperationLinks } }`. The plan extends this facade — see §7.5 for the new method names.
* **Exception listing today** — `ListReconciliationExceptionsInputSchema` in `packages/modules/reconciliation/src/contracts/queries.ts` accepts `source`, `state`, `limit ≤ 100`, `offset`. The plan adds optional `runId`, `externalRecordId`, `exceptionType`, `severity`, `assignedTo`, `dueBefore`, `valueDateFrom`, `valueDateTo`, `currencyCode` filters; pagination stays limit/offset for compatibility.
* **Test pattern** — integration tests boot a real Postgres pool, instantiate the service with mocked external ports, drive `worker.runOnce({ now, signal })`, then clean rows in reverse FK order in `afterEach`. See `packages/modules/reconciliation/tests/integration/worker.test.ts`. New parser packages follow this layout.

---

## 2. Proposed reconciliation domain model

The plan **extends** the existing schema in `packages/modules/reconciliation/src/infra/drizzle/schema/index.ts` and adds new tables. All new columns and tables are in a single new migration generated by `bun run db:generate` (per the cutover policy this is a single forward-only migration; legacy data migration is not required).

For each table: P=purpose, F=fields, I=indexes, U=unique, S=status enum, R=relations, IM=immutable, A=audit.

### 2.1 Provider report files (NEW)

**`reconciliation_provider_report_files`** — one row per ingested raw report file (CSV / JSON / API-paginated dump persisted as a single artefact).

* P: opaque, immutable record of "we received provider report file X from provider Y for period Z". Reconciliation rows derive from this.
* F: `id` uuid PK, `provider` text (`stripe|adyen|wise|...`), `account_id` text (provider account ID — NEEDS_DECISION on FK to a future `provider_accounts` table), `period_start` timestamptz null, `period_end` timestamptz null, `file_asset_id` uuid → `file_assets.id` (raw blob; immutable via files module), `file_version_id` uuid → `file_versions.id`, `report_kind` text (`balance_transactions|payouts|settlement_details|statement|...`), `format` text (`csv|json|xml|...`), `checksum` text (mirrors file version checksum), `received_at` timestamptz, `parsed_at` timestamptz null, `parse_status` text enum `pending|parsed|failed`, `parse_error` text null, `row_count` integer null, `request_id`, `correlation_id`, `trace_id`, `causation_id`, `created_at`.
* U: `(provider, checksum)`. Same file ingested twice is a no-op.
* I: `(provider, period_start, period_end)`, `(parse_status, received_at)`.
* R: `file_assets`, `file_versions`.
* IM: yes (insert + status updates only; never edit `file_asset_id`/`checksum`).
* A: store ingester user id when manual.

### 2.2 Provider movements (NEW canonical table)

**`reconciliation_provider_movements`** — rows extracted from a provider report file, normalized into the canonical movement shape (§3).

* P: one provider-side financial event in canonical form.
* F: `id` uuid PK, `provider_report_file_id` uuid → above, `provider` text, `provider_account_id` text, `provider_record_id` text (Stripe `bt_…`, Adyen `pspReference`, Wise `referenceNumber`), `parent_provider_record_id` text null (e.g., refund→charge), `movement_type` text enum (§3 list), `currency_code` text (ISO 4217), `amount_minor` bigint (signed; positive = credit / inflow to provider balance, negative = debit / outflow), `gross_amount_minor` bigint null, `fee_amount_minor` bigint null, `net_amount_minor` bigint null, `fx_from_currency` text null, `fx_to_currency` text null, `fx_rate_num` bigint null, `fx_rate_den` bigint null, `occurred_at` timestamptz (provider event time), `available_on` timestamptz null (settlement availability), `payout_id` text null, `external_reference` text null (merchant reference, our internal ID echoed back), `raw_row` jsonb (the raw row as stored), `normalization_version` text, `external_record_id` uuid → `reconciliation_external_records.id` (1:1 link so the existing matching engine works without rewrite — see 2.6), `created_at`.
* U: `(provider, provider_record_id)`. Replays of the same row are idempotent.
* I: `(provider, occurred_at)`, `(provider, payout_id)`, `(provider, external_reference)`, `(movement_type, currency_code, occurred_at)`.
* R: `reconciliation_provider_report_files`, `reconciliation_external_records`.
* IM: yes.
* A: every row references its source file via `provider_report_file_id`.

### 2.3 Bank documents (NEW)

**`reconciliation_bank_documents`** — one bank statement file (PDF, MT940, CAMT.053, CSV). Distinct from existing `documents` because these are external evidentiary artefacts, not internal operational documents.

* P: immutable wrapper around an uploaded bank statement, scoped to one bank account and one statement period.
* F: `id` uuid PK, `organization_requisite_id` uuid → `parties.requisites` (the **bank account** this statement is for; see §1 — `requisites` already models bank accounts), `bank_name` text null, `format` text enum `mt940|camt053|camt052|csv|pdf|json`, `period_start` timestamptz, `period_end` timestamptz, `opening_balance_minor` bigint null, `closing_balance_minor` bigint null, `currency_code` text, `file_asset_id` uuid → `file_assets.id`, `file_version_id` uuid → `file_versions.id`, `checksum` text, `received_at` timestamptz, `parsed_at` timestamptz null, `parse_status` text enum `pending|parsed|failed`, `parse_error` text null, `entry_count` integer null, `entry_sum_minor` bigint null, `request_id`, `correlation_id`, `trace_id`, `causation_id`, `created_at`.
* U: `(organization_requisite_id, checksum)`.
* I: `(organization_requisite_id, period_start, period_end)`, `(parse_status, received_at)`.
* R: `parties.requisites`, `files.fileAssets`, `files.fileVersions`.
* IM: yes (file_asset_id, checksum, opening/closing balance never mutate after parse).

NEEDS_DECISION: do we model "this bank account is *ours*" via a flag on `requisites` or a new `organization_bank_accounts` table? Today `requisites` has owner = organization|counterparty but no "treasury account" marker. **Recommendation**: add a boolean `is_treasury_account` (or similar) on the existing organization-owned requisite, scoped per-organization, rather than a new table.

### 2.4 Bank statement entries (NEW)

**`reconciliation_bank_statement_entries`** — rows extracted from a bank document.

* F: `id` uuid PK, `bank_document_id` uuid → above, `organization_requisite_id` uuid (denormalized for indexing), `entry_index` int (preserve file order), `value_date` date, `booking_date` date null, `direction` text enum `credit|debit`, `amount_minor` bigint (always positive; sign captured by `direction`), `currency_code` text, `description` text, `counterparty_name` text null, `counterparty_iban` text null, `counterparty_bic` text null, `bank_reference` text null, `end_to_end_id` text null, `merchant_reference` text null, `entry_type` text enum (mapped to canonical types: `bank_credit|bank_debit|bank_fee|...` — see §3), `raw_row` jsonb, `normalization_version` text, `external_record_id` uuid → `reconciliation_external_records.id`, `created_at`.
* U: `(bank_document_id, entry_index)`.
* I: `(organization_requisite_id, value_date)`, `(organization_requisite_id, amount_minor, currency_code, value_date)`, `(end_to_end_id)`, `(bank_reference)`.
* IM: yes.

### 2.4a Provider balance snapshots (NEW)

**`reconciliation_provider_balance_snapshots`** — point-in-time provider balance reports, distinct from movement reports. Required for the **shadow-ledger / tri-balance** check (§3.4). Stripe's `Balance` endpoint, Adyen's account holder balance, and Wise's balance API all surface this independently of transaction reports.

* P: snapshot of `available / pending / reserved` per `(provider, account, currency)` at a point in time, used to validate `opening + Σ movements = closing`.
* F: `id` uuid PK, `provider` text, `provider_account_id` text, `currency_code` text, `available_minor` bigint, `pending_minor` bigint, `reserved_minor` bigint, `as_of` timestamptz, `provider_report_file_id` uuid → §2.1 (null if pulled from API and snapshotted directly), `raw_payload` jsonb, `created_at`.
* U: `(provider, provider_account_id, currency_code, as_of)`.
* I: `(provider, provider_account_id, as_of)`.
* IM: yes.

### 2.4b Bank balance snapshots (derived)

For bank statements the equivalent already lives in `reconciliation_bank_documents.opening_balance_minor` / `closing_balance_minor`. No separate table needed.

### 2.4c Typed-column denormalization rule (architectural)

`reconciliation_external_records.normalizedPayload` (jsonb) stays as the **flexible bridge** so the existing matcher and the existing `treasury_instruction_outcomes` source keep working unchanged. **However**, the new `reconciliation_provider_movements` and `reconciliation_bank_statement_entries` tables **must denormalize the load-bearing fields into typed columns** (`amount_minor bigint`, `currency_code text`, `movement_type text`, `occurred_at timestamptz`, `value_date date`, `payout_id text`, `external_reference text`). Reasoning: these are the columns matchers, dashboards, and treasury queue queries scan; jsonb-only access requires GIN indexes and `->` operators that prevent fast aggregations and break query planner statistics. The jsonb `raw_row` stays for full provenance and for fields the canonical model does not yet capture.

### 2.5 Reconciliation runs / matches / exceptions — extensions

Existing `reconciliationRuns`, `reconciliationMatches`, `reconciliationExceptions` are reused. Add:

* `reconciliationRuns.kind` text enum `internal_to_provider|provider_to_bank|bank_to_internal|deal_scoped|full|backfill`. Default `deal_scoped` to preserve current behavior.
* `reconciliationRuns.scope_filter` jsonb — already partly covered by `inputQuery`; reaffirm the contract.
* `reconciliationRuns.mode` text enum `live|dry_run|rerun`. Default `live`.
* `reconciliationRuns.lock_key` text — used to enforce single-active-run per `(source, account, period)` (§8).
* `reconciliationRuns.metrics` jsonb — counts per match status, durations, candidates considered.
* `reconciliationMatches.status` enum extends to `matched|unmatched|ambiguous|partial|duplicate`. Confidence scoring lands in `explanation.score` (0..1). Add column `confidence` numeric(5,4) for indexing/filtering. Add `match_kind` text enum `internal_to_provider|provider_to_bank|...` matching `runs.kind`.
* `reconciliationExceptions.state` enum extends to `open|in_review|resolved|ignored|escalated`. **This is a forward-compatible extension**, not a rewrite — existing rows stay valid.
* Add `reconciliationExceptions.exception_type` text enum (§6 list — `missing_internal_payment`, `amount_mismatch`, …). Today only `reasonCode` (free-form) exists. Backfill empty rows to a sensible default during the migration if any prod data — for the cutover policy this is a `db:nuke` and no backfill is required.
* Add `reconciliationExceptions.severity` text enum `info|warning|critical`.
* Add `reconciliationExceptions.assigned_to` uuid → `iam.users` null.
* Add `reconciliationExceptions.due_at` timestamptz null.

### 2.6 Reconciliation resolutions (NEW)

**`reconciliation_resolutions`** — explicit append-only event log of every action taken on an exception. The existing model reuses `documents` for adjustments; this table captures *non-adjustment* actions too (manual match, ignore, escalate, comment, status change, assignment) without mutating raw data.

* F: `id` uuid PK, `exception_id` uuid → `reconciliation_exceptions`, `actor_user_id` uuid → `iam.users`, `action` text enum `manual_match|unmatch|ignore|unignore|escalate|comment|assign|state_change|attach_document`, `reason_code` text null (§7 list), `note` text null, `payload` jsonb (e.g., the manual match decision: matched record IDs, score), `correlation_id`, `trace_id`, `created_at`.
* I: `(exception_id, created_at)`, `(actor_user_id, created_at)`.
* IM: yes (append-only). All exception state changes after creation are derived by replaying this table.

### 2.7 Reuse decisions vs adapters

* `ledger.ledgerOperations` — reuse as-is. It is the internal ledger truth.
* `treasury.paymentSteps`, `paymentStepReturns`, `paymentStepAttempts` — reuse as-is. They carry the "expected" intent and the operational state machine. The reconciliation matcher loads them via `ReconciliationLedgerLookupPort` (already exists) extended with new query methods.
* `documents` — reuse for adjustment / correction posting flows; do not store raw bank/provider data here.
* `files` — reuse for raw blobs (raw provider report file, raw bank statement file). Add `purpose: "reconciliation_provider_report"` and `purpose: "reconciliation_bank_document"` link kinds in `fileLinks`.

NEEDS_DECISION: introduce an `expected_provider_fee` table or keep using `calculations.calculation_lines` with `kind = provider_fee_expense`? **Recommendation**: keep using `calculations` and expose a port `CalculationsExpectedFeesPort` from reconciliation; do not duplicate.

### 2.8 Audit and immutability summary

| Table | Immutable rows? | Audit table |
|---|---|---|
| `provider_report_files` | yes (status only) | new `reconciliation_resolutions` covers user actions; file content immutable via `files` |
| `provider_movements` | yes | derives from immutable raw row |
| `bank_documents` | yes (status only) | same |
| `bank_statement_entries` | yes | same |
| `reconciliation_runs` | yes (terminal) | metrics in run; state transitions append `reconciliation_resolutions` |
| `reconciliation_matches` | yes per run | new run produces new matches; old matches kept |
| `reconciliation_exceptions` | mutable state column only | every state mutation creates a `reconciliation_resolutions` row |
| `reconciliation_resolutions` | yes (append-only) | self |

---

## 3. Canonical financial movement model

A single shape for "one financial event" applicable to provider movements and bank statement entries. Internal ledger entries are *not* re-encoded into this shape — they are matched against it via the existing `ledger.ledgerOperations` and `treasury.paymentSteps` rows.

```ts
// packages/modules/reconciliation/src/contracts/canonical-movement.ts
export const MovementType = z.enum([
  // payment lifecycle
  "payment_captured",            // provider charged the customer (Stripe charge/payment, Adyen Payment)
  "payment_settled",             // funds available in provider balance (Stripe payment w/ available_on, Adyen Settled)
  "payment_failed",              // attempted capture failed (Stripe payment_failure_refund, Adyen RefundedExternally on fail)
  "refund",                      // provider refunded the customer (Stripe refund, Adyen Refunded)
  "refund_failure",              // refund could not be applied (Stripe refund_failure)
  "chargeback",                  // disputed reversal (Stripe adjustment(chargeback), Adyen Chargeback)
  "chargeback_reversed",         // dispute won, money returned (Adyen ChargebackReversed)
  "dispute_fee",                 // scheme/PSP dispute handling fee
  // fees and adjustments
  "fee",                         // PSP processing fee (Stripe stripe_fee, application_fee, Adyen Fee)
  "network_cost",                // card-scheme cost passed through (Stripe network_cost)
  "provider_adjustment",         // arbitrary provider correction (Stripe adjustment, Adyen ManualCorrected/DepositCorrection)
  // FX
  "fx_conversion",               // FX leg inside provider balance (Stripe currency conversion, Wise CONVERSION)
  // transfers between provider sub-accounts
  "transfer",                    // Stripe transfer / Connect collection (transfer, connect_collection_transfer)
  "transfer_reversal",           // Stripe transfer_failure / transfer_cancel / transfer_refund
  "topup",                       // manual provider balance top-up (Stripe topup)
  "topup_reversal",              // Stripe topup_reversal
  "inbound_transfer",            // ACH/wire arriving on provider balance (Stripe inbound_transfer)
  "inbound_transfer_reversal",   // Stripe inbound_transfer_reversal
  // reserves
  "reserve_hold",                // Stripe reserve_hold, payment_network_reserve_hold, payout_minimum_balance_hold; Adyen ReserveAdjustment(+)
  "reserve_release",             // matching release events; Adyen ReserveAdjustment(-)
  // payout / bank
  "payout",                      // provider wired out to bank (Stripe payout, Adyen MerchantPayout)
  "payout_failure",              // payout returned/failed (Stripe payout_failure)
  "bank_credit",                 // bank received money (statement credit)
  "bank_debit",                  // bank sent money (statement debit)
  "bank_fee",                    // bank charged us
  // financing (Stripe Capital and similar)
  "advance",                     // Stripe advance / advance_funding
  "advance_repayment",           // Stripe anticipation_repayment
  // issuing (Stripe Issuing — out of scope for v1; reserved enum for forward-compat)
  "issuing_authorization_hold",
  "issuing_authorization_release",
  "issuing_transaction",
  "issuing_dispute",
  // catch-all
  "unknown",
]);

export const CanonicalMovement = z.object({
  source: z.enum(["provider", "bank"]),
  source_kind: z.string(),                     // e.g. "stripe", "adyen", "wise", "bank:deutsche_bank"
  source_record_id: z.string(),                // unique within source
  parent_source_record_id: z.string().nullish(),
  movement_type: MovementType,
  currency_code: z.string().length(3),
  amount_minor: z.string().regex(/^-?\d+$/),   // signed bigint as string for transport
  gross_amount_minor: z.string().regex(/^-?\d+$/).nullish(),
  fee_amount_minor: z.string().regex(/^-?\d+$/).nullish(),
  net_amount_minor: z.string().regex(/^-?\d+$/).nullish(),
  fx: z.object({
    from_currency: z.string().length(3),
    to_currency: z.string().length(3),
    rate_num: z.string().regex(/^-?\d+$/),
    rate_den: z.string().regex(/^-?\d+$/),
  }).nullish(),
  occurred_at: z.string().datetime(),          // event time
  available_on: z.string().datetime().nullish(), // settlement time
  payout_id: z.string().nullish(),             // groups movements into a payout batch
  external_reference: z.string().nullish(),    // our internal ID echoed back
  counterparty: z.object({
    name: z.string().nullish(),
    iban: z.string().nullish(),
    bic: z.string().nullish(),
  }).nullish(),
  raw: z.unknown(),                            // verbatim row
});
```

Persistence: `provider_movements` and `bank_statement_entries` are the typed projections of this Zod shape (one per source). Their `raw_row` jsonb keeps the unparsed source. **`reconciliation_external_records.normalizedPayload` stores the full canonical movement** so the existing matching engine continues to work without a schema change.

### 3.1 Mapping table

Sourced from the public docs of each provider. Treat the Adyen and Wise rows as the v1 best-effort mapping; both vendors' enum surfaces are not fully public — the parsers must be validated against real fixture exports from each tenant's account before Phase 2 closes.

| Canonical type | Internal ledger / treasury source | Stripe `BalanceTransaction.type` | Adyen `Settlement Details` row type | Wise statement movement | Bank statement entry |
|---|---|---|---|---|---|
| `payment_captured` | `paymentSteps.kind=payin` & state=`processing`/`completed` | `charge`, `payment` | `Payment` | n/a | n/a |
| `payment_settled` | `paymentSteps.state=completed`; `paymentStepAttempts.outcome=settled` | `payment` w/ `available_on` | `Settled` | `BALANCE` cr from settlement | `bank_credit` of payout |
| `payment_failed` | `paymentStepAttempts.outcome=failed` | `payment_failure_refund` | `RefundedExternally` (failed leg) | n/a | n/a |
| `refund` | `paymentStepReturns(reason!="chargeback")` | `refund` | `Refunded` | balance debit (negative) | n/a |
| `refund_failure` | UNKNOWN — flag for design | `refund_failure` | `RefundedExternally` (failed) | n/a | n/a |
| `chargeback` | `paymentStepReturns(reason="chargeback")` | `adjustment` (chargeback) | `Chargeback` | balance debit | n/a |
| `chargeback_reversed` | adjustment doc reversing the loss | `adjustment` (reversal) | `ChargebackReversed` | n/a | n/a |
| `dispute_fee` | `feeRules` outcome with chargeback context | `adjustment` (dispute fee) | `Fee` w/ dispute context | `FEE` | n/a |
| `fee` | `feeRules` outcome, `calculations.provider_fee_expense` | `stripe_fee`, `application_fee`, `application_fee_refund` | `Fee` | `FEE` | n/a |
| `network_cost` | `calculations.provider_fee_expense` (interchange line) | `network_cost` | included in `Fee` (Adyen does not break out separately) | n/a | n/a |
| `provider_adjustment` | adjustment doc | `adjustment` | `ManualCorrected`, `DepositCorrection`, `InvoiceDeduction` | `ADJUSTMENT` | n/a |
| `fx_conversion` | `quoteExecutions` | currency conversion balance txns | `MerchantPayout` w/ FX | `CONVERSION` | n/a |
| `transfer` | UNKNOWN — Connect/marketplace flows not in repo today | `transfer`, `connect_collection_transfer` | n/a (single-merchant) | n/a | n/a |
| `transfer_reversal` | UNKNOWN | `transfer_failure`, `transfer_cancel`, `transfer_refund` | n/a | n/a | n/a |
| `topup` | `paymentSteps.kind=intercompany_funding` | `topup` | n/a | n/a | counterpart `bank_debit` from a treasury account |
| `topup_reversal` | UNKNOWN | `topup_reversal` | n/a | n/a | n/a |
| `inbound_transfer` | `paymentSteps.kind=intracompany_transfer` | `inbound_transfer` | n/a | n/a | counterpart `bank_credit` |
| `inbound_transfer_reversal` | UNKNOWN | `inbound_transfer_reversal` | n/a | n/a | n/a |
| `reserve_hold` | UNKNOWN — no internal table | `reserve_hold`, `payment_network_reserve_hold`, `payout_minimum_balance_hold` | `ReserveAdjustment` (positive) | n/a | n/a |
| `reserve_release` | UNKNOWN | `reserve_release`, `payment_network_reserve_release`, `payout_minimum_balance_release` | `ReserveAdjustment` (negative) | n/a | n/a |
| `payout` | `paymentSteps.kind=payout` | `payout` | `MerchantPayout` | balance debit at settlement | matches `bank_credit` on our account |
| `payout_failure` | `paymentStepAttempts.outcome=failed` for payout | `payout_failure` | `MerchantPayout` reversed | n/a | counterpart `bank_debit` reversal |
| `advance` | UNKNOWN — Stripe Capital not used today | `advance`, `advance_funding` | n/a | n/a | n/a |
| `advance_repayment` | UNKNOWN | `anticipation_repayment` | n/a | n/a | n/a |
| `issuing_*` | OUT OF SCOPE v1 | `issuing_authorization_hold`, `issuing_authorization_release`, `issuing_transaction`, `issuing_dispute` | n/a | card-transaction movements | n/a |
| `bank_credit` | `paymentSteps` outcomes / `ledger.postings` | n/a | n/a | n/a | direction=credit |
| `bank_debit` | `paymentSteps` outcomes / `ledger.postings` | n/a | n/a | n/a | direction=debit |
| `bank_fee` | dedicated `feeRules` (`operationKind=external_transfer`) | n/a | n/a | n/a | description-pattern + small amount + same-day |
| `unknown` | — | unmapped | unmapped | unmapped | unmapped |

UNKNOWN markers identify provider-row types that have no current internal counterpart. NEEDS_DECISION before Phase 2 ships: do we model reserves, transfers, top-ups, advances as new internal entities, or treat them as `provider_adjustment` exceptions to be booked manually?

References used for the Stripe column: <https://docs.stripe.com/api/balance_transactions/object>. Adyen and Wise type lists are not fully enumerated in public docs; verify against tenant fixtures.

### 3.2 Date semantics — value-date vs booking-date

A single financial event has up to four timestamps that the matcher must distinguish:

| Field | Definition | Used for |
|---|---|---|
| `occurred_at` | Provider event time / bank entry creation. Always set. | Audit, ordering. |
| `available_on` | Provider settlement availability. Stripe `available_on`, Adyen settlement date, bank `value_date`. | **Matching window primary key.** |
| `booking_date` | Bank booking date (when the entry posted to the ledger). | Detect bank-side delay vs `value_date`. |
| `posting_date` | Internal `ledger.ledgerOperations.postingDate`. | Period attribution. |

Matcher policy: **match on `available_on` (or `value_date` for bank rows)**, not on `occurred_at`. A bank entry whose `value_date` is today but `booking_date` is +2 days is still a same-period match. A bank entry whose `booking_date - value_date > N` is allowed to match but raises a `bank_entry_booking_lag` warning exception.

### 3.3 Cutoff times, holiday calendars, settlement windows

The matcher's "should this have settled by now" logic must use **business days**, not calendar days.

* New table `reconciliation_settlement_calendar` (id, scope_kind enum `provider|bank|currency|country`, scope_value, date, is_settlement_day boolean). Seeded by a small fixture file and refreshed via a scheduled `RefreshSettlementCalendarJob` from a public source (e.g., TARGET2 calendar for EUR, Federal Reserve calendar for USD). NEEDS_DECISION: source.
* `MatchTolerance.dateWindow` becomes `{ businessDays: number; calendarDaysCap: number }`. Compute by walking the calendar; cap by calendar days so we never wait forever.
* Provider report cutoffs: each `provider` has a `report_cutoff_time` (e.g., Stripe payouts post at ~04:00 UTC). The reconciliation runner must skip a period whose cutoff has not yet passed at run time; otherwise late events surface as bogus `missing_*` exceptions.

### 3.4 Shadow ledger / tri-balance reconciliation

The strongest reconciliation check is **balance continuity**, not row-by-row matching:

```
opening_balance + Σ movements_in_period == closing_balance
```

* Provider side: `reconciliation_provider_balance_snapshots` (§2.4a) gives `opening` and `closing` per `(provider, account, currency, period)`. Movements come from `reconciliation_provider_movements`.
* Bank side: `reconciliation_bank_documents.opening_balance_minor` / `closing_balance_minor` plus the entry sum.
* New domain helper `domain/shadow-ledger.ts: reconcileShadowBalance(opening, movements[], closing) → { delta_minor, ok, drift_attribution[] }` that runs once per `(source, account, currency, period)` per run. A non-zero delta produces a `shadow_balance_mismatch` exception (severity `critical`) regardless of any row-level matches — i.e., even if every row matched something internally, a shadow drift means we are missing a row.

### 3.5 Multi-hop / transitive matching

Some flows traverse multiple providers (Stripe → Wise → bank). The matcher needs an explicit "chain" concept:

* New table `reconciliation_movement_links` (id, parent_movement_id, child_movement_id, link_kind enum `payout_to_bank|provider_to_provider|deposit|...`, confidence, evidence jsonb).
* New direction `provider_to_provider` (run kind) — links Stripe `payout` movements to Wise `inbound_transfer` movements.
* `domain/transitive-match.ts: walkChain(seed) → MovementChain` — expands a seed event (e.g., an internal payment) along all known link kinds and reports whether the chain closes on a bank entry. Failure → `transitive_mismatch` exception with the broken edge highlighted.

---

## 4. Import pipeline

Every import follows the same five stages: **fetch → store raw → parse → normalize → emit**. Each stage is idempotent.

### 4.1 Provider reports

* **Fetch**:
  * File mode: an admin uploads via API; file goes through `files` module.
  * API mode: a worker pulls (Stripe `BalanceTransactions.list`, Adyen `SettlementDetails`, Wise `Statement`). API responses are persisted as files (one file per cursor page) so the raw evidence is preserved. Polling cursors stored in a new tiny table `reconciliation_provider_cursors` (id, provider, account_id, cursor, last_synced_at). NEEDS_DECISION whether to use `worker-runtime` cursor table or a new one.
* **Store raw**: write file via `@bedrock/files` (S3) and create `reconciliation_provider_report_files` row referencing it. `(provider, checksum)` unique → replays return existing row.
* **Parse**: provider-specific parser converts file rows into Zod-validated `CanonicalMovement[]`. Parsers live in new packages `packages/modules/provider-stripe/`, `packages/modules/provider-adyen/`, `packages/modules/provider-wise/`. Each exposes `parseReport(buffer, kind, options): { movements: CanonicalMovement[]; warnings; errors }`. No HTTP calls in parsers.
* **Validate**: Zod parse each movement; reject the *file* (set `parse_status=failed`, store error) on schema-level corruption; otherwise reject *rows* (record warnings, still parse the rest).
* **Normalize**: deterministic; assign `movement_type` from provider type, copy fees, FX, dates. Stamp `normalization_version` = parser SemVer.
* **Idempotency**: `(provider, provider_record_id)` is the dedup key. Re-import of the same file → 0 inserts. Re-import of an *amended* row from the same provider with a new `provider_record_id` → an `unknown` row that the matcher detects as a candidate `provider_adjustment`.
* **Linkage to raw**: every `provider_movements` row carries `provider_report_file_id`; every external record carries `(source_kind, raw_row)` in its raw payload.
* **Re-run**: `ReimportProviderReportJob` accepts a `reconciliation_provider_report_files.id`, reparses, and inserts only new movements. Old movements are not deleted; `normalization_version` divergence is logged.
* **Failure handling**: `parse_status=failed` plus structured Pino error with `provider_report_file_id`. Retried up to N (configurable) times with exponential backoff via the worker fleet.

### 4.2 Bank statements

Same pipeline with `reconciliation_bank_documents` + `reconciliation_bank_statement_entries`. Parsers per format, in priority order for v1:

* **CAMT.053** (ISO 20022 end-of-period statement) — primary v1 target. Most commercial European banks support it.
* **CAMT.052** (ISO 20022 intraday report) — same library; useful for near-real-time matching.
* **CAMT.054** (ISO 20022 debit/credit notification) — single-event push, useful when banks deliver per-transaction notifications. Add in v1.1.
* **MT940** (SWIFT legacy) — required for a number of incumbent banks; parser typically shares the codebase with CAMT.
* **CSV** — bank-specific parser per integration; one adapter per bank.
* **BAI2 / OFX** — deferred to v2 unless a US-domiciled treasury account requires it earlier.
* **PDF** — out of scope for v1.

Library choice: NEEDS_DECISION (battle-tested options vary widely in license / quality; the parser package should keep an adapter interface so the implementation can be swapped). Parsers live in `packages/modules/bank-statement-parsers/` (sibling to `provider-*`).

Idempotency key: `(organization_requisite_id, checksum)` for files; `(bank_document_id, entry_index)` for entries.

### 4.4 Upload route shape (echoes existing convention)

```ts
// apps/api/src/routes/reconciliation.ts (new)
const route = createRoute({
  middleware: [requirePermission({ reconciliation: ["import"] })],
  method: "post",
  path: "/reconciliation/imports/provider-reports",
  tags: ["reconciliation"],
  request: { body: { content: { "multipart/form-data": { schema: ImportProviderReportFormSchema } } } },
  responses: { 201: { description: "...", content: { "application/json": { schema: ImportProviderReportResponseSchema } } } },
});

app.openapi(route, async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!file || typeof file === "string") throw new ValidationError("file required");
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await ctx.reconciliationService.imports.ingestProviderReport({
    provider: body.provider as string,
    reportKind: body.reportKind as string,
    file: { buffer, fileName: file.name, fileSize: file.size, mimeType: file.type },
    uploadedBy: c.get("user")!.id,
    idempotencyKey: c.req.header("Idempotency-Key")!,
  });
  return jsonOk(c, result);
});
```

The handler delegates to `ingestProviderReport`, which wraps `withIdempotencyTx({ scope: "recon.ingestProviderReport", ... })` per §1.12.

### 4.3 Internal expected ledger / payment data

No import needed — these tables already exist and are ground truth. The matcher reads them via ports (§5.4).

### 4.4 Storage of raw payloads

* Raw bytes → S3 via `files` module.
* Raw row jsonb → `provider_movements.raw_row` and `bank_statement_entries.raw_row` (so a single SQL query can render the original row even without S3 access).
* `external_records.raw_payload` retains the canonical movement plus a pointer to the source file row.

### 4.5 Linking

```
file_assets ─┬─→ provider_report_files ─→ provider_movements ─→ external_records
             └─→ bank_documents       ─→ bank_statement_entries ─→ external_records
```

Every reconciled row can be traced back to a byte range of an immutable file.

---

## 5. Matching engine

### 5.1 Matching directions

Four independent run kinds (one matcher per direction):

1. `internal_to_provider` — match internal `paymentSteps` / `paymentStepReturns` / `ledgerOperations` against provider movements.
2. `provider_to_bank` — match provider `payout` movements against `bank_statement_entries`.
3. `bank_to_internal` — match unmatched bank entries against internal `paymentSteps` (for direct bank-to-bank flows that bypass providers).
4. `provider_to_provider` — link movements across providers when one provider settles into another (e.g., Stripe payout → Wise inbound transfer). Drives §3.5 transitive matching.

Each direction is a separate `runs.kind`. A scheduled `full` run dispatches all four in order: `internal_to_provider → provider_to_provider → provider_to_bank → bank_to_internal`.

### 5.2 Match strategies (evaluated as evidence, not as first-match-wins)

For each `(externalRecord, candidate)` pair, run **every** strategy and record per-component evidence in `MatchEvidence`. The score (§5.4) combines them. Earlier "first match wins" was a footgun — it lets one strong ID match shadow a contradicting amount.

1. **Exact internal ID** — `external_reference` equals our `paymentStep.id` / `documents.id`. Strongest signal.
2. **Provider reference** — provider returns the same `provider_record_id` we stored on `paymentStepAttempts.providerRef`. Strong signal.
3. **Merchant reference** — `merchant_reference` / `end_to_end_id` matches our internal correlation ID. Strong signal.
4. **Payout-batch grouping** — movements with same `payout_id` aggregate; match the aggregate against a single bank credit entry. Aggregation must be **net of provider fees** when the provider settles net.
5. **Amount + currency + value-date window** — `|amount_minor - candidate| ≤ tolerance`, currency exact, value-date within tolerance window (in **business days**, §3.3). Use this whenever no ID-grade match was available.
6. **Counterparty heuristics** — IBAN equality > IBAN substring > BIC equality > name token overlap. IBAN-equality is treated almost as strongly as a provider reference; name overlap is a tiebreaker only.
7. **Linkage chain** — if a candidate is already part of a `reconciliation_movement_links` chain (§3.5) that includes the external record, the chain edge counts as positive evidence.

### 5.3 Tolerances

```ts
// packages/modules/reconciliation/src/domain/tolerance.ts
type MatchTolerance = {
  amountAbsoluteMinor: bigint;       // e.g. 1n (1 cent)
  amountRelativeBps: number;         // e.g. 5 = 0.05%
  dateWindow: { businessDays: number; calendarDaysCap: number };
  currencyExact: true;               // never relax
};
```

`reconciliation_tolerance_rules` (NEW):

* F: `id`, `source`, `match_kind`, `movement_type` null, `currency_code` null, `amount_min_minor` bigint null, `amount_max_minor` bigint null, `amount_absolute_minor` bigint, `amount_relative_bps` int, `date_window_business_days` int, `date_window_calendar_days_cap` int, `effective_from`, `effective_to`, `created_at`.
* `amount_min_minor` / `amount_max_minor` add **amount-band scoping** — different tolerances for $10 vs $1M transactions (a flat 1¢ absolute is too tight for million-dollar payouts, a flat 5 bps is too loose for tiny fees).
* Resolution order: most-specific match wins (matched on equal-or-tighter dimensions); a default catch-all row is required at boot.

### 5.4 Confidence scoring — conditional, not additive

The earlier additive formula admitted false high-confidence matches: a candidate could score ≥ 0.9 by accumulating cheap evidence even when amount disagreed. Replace it with a **conditional pipeline** that anchors on identity and penalises contradictions:

```
inputs:  evidence: MatchEvidence
outputs: score ∈ [0,1], status, reasons[]

1. Anchor: if any of (idMatch, providerRef, merchantRef, ibanEqual, chainEdge) is true:
       score := 0.95
   else if amount within tolerance AND currency exact AND date within window:
       score := 0.75   # plausible but identity-free match
   else:
       score := 0.40   # a candidate but very weak

2. Add small bonuses (capped at +0.04 total) for soft signals:
       counterpartyNameMatch:        +0.02
       merchantBicMatch:             +0.02
       chainEdgePresent (and not anchored already): +0.02

3. Apply hard penalties (multiplicative, applied in order):
       currency mismatch:                       score := min(score, 0.30)
       amount > tolerance (any band):           score := min(score, 0.50)
       date outside calendar-days cap:          score := min(score, 0.45)
       internal status disagrees (e.g. internal=failed, provider=settled):
                                                score := min(score, 0.40)

4. Clamp to [0, 1].
```

Decision matrix:

| Score | Candidate count | Status | Exception |
|---|---|---|---|
| `≥ 0.95` | exactly 1 | `matched` | none |
| `≥ 0.95` | > 1 | `ambiguous` | `duplicate_match_candidate` |
| `0.70 ≤ s < 0.95` | exactly 1 | `partial` | `partial_match` |
| `0.70 ≤ s < 0.95` | > 1 | `ambiguous` | `duplicate_match_candidate` |
| `< 0.70` | any | `unmatched` | `missing_*` per direction |

Auto-resolve threshold raised from 0.9 to **0.95**. Conservative bias: prefer manual review over a wrong auto-match in financial reconciliation (false-positive cost ≫ false-negative cost). For SOX/GAAP, only `score ≥ 0.95` matches without contradictions count as "fully reconciled" for period close (§14).

### 5.5 Many-to-one and one-to-many

Modeled by inserting *multiple* `reconciliation_matches` rows for the same `external_record_id` (e.g., one provider payout matches many bank credits) or for the same internal counterpart (e.g., one bank credit aggregates many provider payments). Add `match_group_id` uuid to `reconciliation_matches` to group rows that *together* represent one logical match. The `explanation` jsonb records the aggregation arithmetic.

### 5.6 Idempotent re-runs

* Every run is a *new* row in `reconciliationRuns`. Old rows stay.
* New matches reference the new run; **only** matches whose `(externalRecordId, match_kind)` did not appear in any previous *successful* run produce new exceptions. Existing open exceptions are *re-evaluated* — if a new match is found, the exception is automatically resolved with `action="auto_resolved"` in `reconciliation_resolutions`.
* Locking: §8.

### 5.7 Delayed events

* Provider/bank events arrive late after a run. The next run picks them up. Every run logs `now - max(occurred_at)` in `metrics.late_event_lag_seconds_p50/p95`.
* Open exceptions older than `late_match_threshold_days` (config) are auto-promoted from `open` → `in_review` so treasury investigates. Default 7 days.

---

## 6. Exception model

### 6.1 Exception types

`reconciliation_exceptions.exception_type` text enum. Source-of-truth list:

| Type | Created when | Severity | Debug data needed | Resolution actions | Auto-resolvable? | Admin review? |
|---|---|---|---|---|---|---|
| `missing_internal_payment` | provider/bank movement has no internal candidate | warning | external_record, candidates considered | manual match / create internal payment / ignore | yes (next run) | yes |
| `missing_provider_payment` | internal payment expected, no provider movement | warning | internal id, expected provider, search window | wait / manual match / mark failed | yes | yes |
| `missing_bank_transaction` | provider payout expected to settle, no bank credit | critical (after SLA) | payout_id, expected amount/date, bank account | wait / contact bank / create adjustment | yes | yes |
| `unexpected_bank_transaction` | bank credit/debit not matched to any internal/provider event | critical | full bank entry | manual match / create internal record / ignore as fee | yes | yes |
| `amount_mismatch` | candidate matches by ID but amount differs > tolerance | critical | both amounts, tolerance used, currency | adjust / accept FX/rounding / escalate | partial | yes |
| `currency_mismatch` | currencies differ | critical | both currencies | almost always manual | no | yes |
| `status_mismatch` | internal `paymentStep.state=completed` but provider says `failed` | critical | both states | reverse internal / accept | no | yes |
| `duplicate_match_candidate` | multiple candidates at score ≥ 0.6 | warning | candidate set + scores | manual pick | yes | yes |
| `partial_match` | exactly one candidate, 0.6 ≤ score < 0.9 | warning | candidate, score, missing components | confirm / reject | yes | yes |
| `provider_fee_mismatch` | provider fee differs from `calculations.provider_fee_expense` > tolerance | warning | expected vs actual, rule | accept (rule update) / dispute | yes (after rule update) | yes |
| `bank_fee_mismatch` | bank fee differs from expected | warning | same | same | yes | yes |
| `fx_mismatch` | FX rate or converted amount differs > tolerance | warning | rate, expected, actual, leg | accept (FX delta) / escalate | yes | yes |
| `provider_bank_mismatch` | provider payout ≠ bank credit (after grouping) | critical | payout group, bank credits | adjust / wait | yes | yes |
| `late_adjustment` | provider posts an adjustment after a closed period | warning | period, amount | accept into next period | no (manual) | yes |
| `unmatched_refund` | provider refund without internal `paymentStepReturn` | critical | refund, candidates | create internal return / ignore | yes | yes |
| `unmatched_chargeback` | chargeback without internal record | critical | chargeback, candidates | create case / accept loss | no | yes |
| `chargeback_fee_mismatch` | observed dispute fees ≠ expected fee schedule | warning | expected vs actual fee, fee rule | accept / dispute | yes | yes |
| `shadow_balance_mismatch` | provider/bank opening + Σ movements ≠ closing (§3.4) | critical | period, opening, sum, closing, delta | re-pull report / wait for late events / book adjustment | yes (after re-pull) | yes |
| `bank_entry_booking_lag` | bank entry's `booking_date - value_date` > policy threshold | info | both dates, account | accept / flag bank | yes | optional |
| `transitive_mismatch` | multi-hop chain (§3.5) does not close on a bank entry | critical | chain edges, missing edge | wait / book adjustment | yes (when missing leg arrives) | yes |
| `multi_hop_mismatch` | provider→provider link (e.g. Stripe payout vs Wise inbound) amounts diverge > tolerance | critical | both legs | adjust / wait | yes | yes |
| `late_provider_balance_snapshot` | balance snapshot for a closed period arrives late and changes the shadow check | warning | snapshot, prior shadow result | re-run reconciliation for period | yes | yes |
| `unknown_provider_movement_type` | parser produced `movement_type=unknown` (new provider event) | warning | raw row, normalization version | parser update, re-normalize | yes (after parser update) | yes |

Severity drives default `due_at` and pages.

### 6.2 Lifecycle

Per §2.5 the state machine extends to `open → in_review → resolved | ignored | escalated`. Transitions allowed:

* `open → in_review` (manual or auto after `late_match_threshold_days`)
* `in_review → open` (returned to backlog)
* any → `resolved` (with reason; immutable after)
* any → `ignored` (with reason)
* any → `escalated` (with note + reassignment)
* `escalated → in_review` (after triage)

Every transition appends a `reconciliation_resolutions` row.

---

## 7. Manual resolution workflow

### 7.1 Resolution reason taxonomy

`reconciliation_resolutions.reason_code` text enum (validated by Zod):

```
matched_manually
bank_delay
provider_delay
rounding_difference
fx_difference
provider_adjustment
bank_fee
wrong_reference
duplicate_internal_record
duplicate_provider_record
accounting_correction
fraud_or_chargeback
other
```

### 7.2 API endpoints (treasury queue)

All under a new `apps/api/src/routes/reconciliation.ts` router (separate from the deal-scoped subset). Hono + `registerIdempotentMutationRoute` for mutations. Permissions in 7.4.

| Method + path | Purpose | Permission |
|---|---|---|
| `POST /reconciliation/imports/provider-reports` | Upload + register a provider report file | `reconciliation:import` |
| `POST /reconciliation/imports/bank-documents` | Upload + register a bank statement | `reconciliation:import` |
| `GET /reconciliation/runs` | List runs (filters: kind, source, period, status) | `reconciliation:list` |
| `GET /reconciliation/runs/{id}` | Run details + summary | `reconciliation:list` |
| `POST /reconciliation/runs` | Trigger a run (kind, scope, mode) | `reconciliation:run` |
| `GET /reconciliation/exceptions` | List exceptions (filters: state, type, severity, source, period, assignee, search) | `reconciliation:list` |
| `GET /reconciliation/exceptions/{id}` | Exception + candidates + resolution history | `reconciliation:list` |
| `POST /reconciliation/exceptions/{id}/match` | Manual match (target operation/document/movement) | `reconciliation:match` |
| `POST /reconciliation/exceptions/{id}/unmatch` | Reverse a manual match | `reconciliation:match` |
| `POST /reconciliation/exceptions/{id}/resolve` | Resolve with reason + optional adjustment doc | `reconciliation:resolve` |
| `POST /reconciliation/exceptions/{id}/ignore` | Ignore with reason | `reconciliation:ignore` |
| `POST /reconciliation/exceptions/{id}/escalate` | Escalate with assignee + note | `reconciliation:escalate` |
| `POST /reconciliation/exceptions/{id}/comment` | Add a comment | `reconciliation:comment` |
| `POST /reconciliation/exceptions/{id}/assign` | Assign to user | `reconciliation:resolve` |
| `GET /reconciliation/unmatched/bank-entries` | Listing | `reconciliation:list` |
| `GET /reconciliation/unmatched/provider-movements` | Listing | `reconciliation:list` |
| `GET /reconciliation/exports/run/{id}.csv` | Run export | `reconciliation:export` |

### 7.3 UI screens (apps/finance — treasury surface)

* `/treasury/reconciliation/queue` — Table of open + in_review exceptions. Columns: severity, type, source, occurred_at, currency, amount, candidate, assignee, age. Quick actions: match, ignore, escalate.
* `/treasury/reconciliation/queue/{id}` — Detail. Left pane: external record + raw row toggle. Center: candidate matches with score. Right: resolution history (from `reconciliation_resolutions`). Buttons map to mutation endpoints.
* `/treasury/reconciliation/runs` — Run list with summary cards.
* `/treasury/reconciliation/runs/{id}` — Run detail with metrics, slowest matchers, late events.
* `/treasury/reconciliation/imports` — Two upload widgets (provider report, bank document) plus a recent-imports list.

UI follows the existing finance app Next.js pattern (App Router, server components for lists, client components for forms; reuse design system components from `packages/sdk/`).

### 7.4 Permissions and roles

Add (or reuse, where applicable) the following permission strings to `apps/api/src/middleware/permission.ts`:

```
reconciliation:list
reconciliation:run
reconciliation:import
reconciliation:match
reconciliation:resolve
reconciliation:ignore
reconciliation:escalate
reconciliation:comment
reconciliation:export
```

Role mapping recommendation:

* `admin` — all permissions.
* `finance` — all except `reconciliation:import` (NEEDS_DECISION; some teams gate imports by ops only).
* `agent` — `reconciliation:list`, `reconciliation:comment`.
* others — none.

NEEDS_DECISION: introduce a dedicated `treasury` role or keep `finance` as the single treasury role.

### 7.5 Manual matching

`POST /reconciliation/exceptions/{id}/match` body:

```ts
{
  target: { kind: "ledger_operation"|"payment_step"|"document"|"provider_movement"|"bank_entry", id: uuid },
  reason_code: enum<ResolutionReason>,
  note?: string
}
```

Effects:

1. Insert a new `reconciliation_matches` row (`status=matched`, `confidence=1.0`, `explanation: { manual: true, actor, reason }`).
2. Append `reconciliation_resolutions(action="manual_match", reason_code, payload)`.
3. Mark exception `state=resolved` only if all linked exceptions for this external record are now matched.
4. **Never mutate** `reconciliation_external_records`, `provider_movements`, `bank_statement_entries`, or original raw rows.

### 7.6 Comments and audit log

* Comments are `reconciliation_resolutions(action="comment")` rows.
* Full audit is the table itself — no separate `audit_log` needed.
* The `documentEvents` shape in `documents` is a precedent; replicate the terse pattern.

---

## 8. Reconciliation runs

### 8.1 Triggers

* **Scheduled**: `RunDailyReconciliationJob` — kicks off `full` run at configurable cron (e.g. 03:00 UTC). Per-source runs at higher frequency (every hour for `internal_to_provider` per provider).
* **Manual via API**: `POST /reconciliation/runs` — admin specifies kind, scope (period, account, deal), mode (`live|dry_run|rerun`).
* **Per-deal**: existing `POST /deals/{id}/reconciliation/run` stays.
* **Worker-driven**: existing `reconciliation` worker continues to process pending sources for `internal_to_provider` direction.

### 8.2 Locking

Single active run per `(kind, scope_key)` where `scope_key` is the canonical hash of `(source, account_id, period_start, period_end)`. Implementation:

* `reconciliation_runs.lock_key` text + a unique partial index `WHERE state IN ('queued','running')`. Cheap table-level guard.
* For the active execution, transaction-scoped advisory lock via `pg_try_advisory_xact_lock(hashtext($1))`. **`@bedrock/platform/persistence` does not currently expose an advisory-lock helper** — Phase 7 must add `packages/platform/src/persistence/advisory-lock.ts: withAdvisoryLock(db, lockKey: string, fn): Promise<T | "locked_out">`.
* Two layers because table-uniqueness alone races on insert; advisory lock alone has no DB-visible state for diagnostics. Together they give a safe, observable guard.

### 8.3 Modes

* `live` — writes matches, exceptions, transitions.
* `dry_run` — writes only the `reconciliation_runs` row + `metrics`; no matches, no exceptions, no resolution rows.
* `rerun` — like `live` but re-evaluates existing open exceptions; can auto-resolve them.
* `incremental` — default; only loads external records since previous successful run for the same `(kind, scope)`.
* `full_period_rebuild` — loads all external records in the scope; useful after a parser bug fix; produces a full new run distinct from prior runs.

### 8.4 Transactional boundaries

Per AGENTS.md: heavy work outside transactions, persistence in short transactions. Per-run flow:

1. Open transaction A: insert run row (`state=queued`).
2. Outside Tx: load external records, run matcher (CPU heavy, no locks).
3. Open transaction B: insert matches, insert/update exceptions, transitions, append resolutions.
4. Open transaction C: finalize run (`state=completed`, write metrics).

If C fails, the run remains as-is and the next run picks up.

### 8.5 Retries

Worker-level retries via `@bedrock/platform/worker-runtime`. Per-run retry policy: exponential backoff up to N attempts; permanent failure → `state=failed` with `failure_reason`. Dead-letter via Pino `error` log + an alert (§13).

### 8.6 Observability

Per-run `metrics` jsonb includes: total external records considered, matched, unmatched, ambiguous, partial, duplicates, exceptions created/resolved/escalated, run duration ms, parser version, ruleset checksum.

---

## 9. API design (consolidated)

See §7.2. Conventions:

* `OpenAPIHono` modules, exported as `createReconciliationRoutes(ctx: AppContext)`.
* All schemas in `packages/modules/reconciliation/src/contracts/{commands,queries,dto}` — already the existing pattern.
* Mutations through `registerIdempotentMutationRoute` to enforce `Idempotency-Key`.
* Read endpoints use `ETag` where appropriate (existing helper).
* Pagination: cursor-based, follow style of existing `apps/api/src/routes/balances.ts` / `apps/api/src/routes/activity.ts`.
* Errors via `ServiceError` subclasses defined in `packages/modules/reconciliation/src/errors.ts` (already exists; add new subclasses per exception cause).

Deal-scoped subset (already implemented, keep) at `apps/api/src/routes/deals.ts`:

```
GET    /deals/{id}/reconciliation/exceptions
POST   /deals/{id}/reconciliation/run
POST   /deals/{id}/reconciliation/exceptions/{exceptionId}/ignore
POST   /deals/{id}/reconciliation/exceptions/{exceptionId}/adjustment-document
```

---

## 10. Background jobs

All implemented in `apps/workers/src/modules/registry.ts` and registered in `apps/workers/src/catalog.ts`. Uses existing `worker-runtime`. Idempotency via `@bedrock/platform/idempotency`.

| Job | Trigger / cadence | Idempotent on | Retries | Failure |
|---|---|---|---|---|
| `ImportProviderReportsJob` | every 5 min per provider | `(provider, account, cursor)` | 5x exp | parsing errors stored on `provider_report_files.parse_status=failed` |
| `ImportBankStatementsJob` | every 15 min per account (or pull from email/SFTP) | `(requisite, checksum)` | 5x exp | same |
| `NormalizeProviderMovementsJob` | within 1 min of file ingest | `(provider_report_file_id)` | 3x | sets file `parse_status` |
| `NormalizeBankStatementEntriesJob` | within 1 min of doc ingest | `(bank_document_id)` | 3x | sets doc `parse_status` |
| `RunReconciliationJob` (scheduled) | daily 03:00 UTC | `(kind, scope, period)` | 3x | run row `state=failed` |
| `MatchInternalToProviderJob` | continuous (existing reconciliation worker, 5s) | `(source, externalRecordId)` | per-record | per-record exception |
| `MatchProviderToBankJob` | continuous (5s) | `(payout_id)` | same | same |
| `BankToInternalJob` | continuous (5s) | `(bank_entry_id)` | same | same |
| `ProviderToProviderLinkJob` | continuous (5s) | `(parent_movement_id, child_movement_id)` | same | same |
| `IngestProviderBalanceSnapshotJob` | hourly per provider | `(provider, account, currency, as_of)` | 3x | snapshot row stays absent |
| `ShadowLedgerCheckJob` | end-of-day per source | `(source, account, currency, period)` | 3x | `shadow_balance_mismatch` exception |
| `RefreshSettlementCalendarJob` | weekly | `(scope_kind, scope_value)` | 3x | log only |
| `DetectExceptionsJob` | implicit in matchers; not a separate job | n/a | n/a | n/a |
| `AutoResolvePendingExceptionsJob` | 1h | `(exceptionId, runId)` | 3x | log + leave open |
| `ExportReconciliationReportJob` | on-demand via API | `(runId, format)` | 3x | error to caller |

Dependencies: `Import* → Normalize* → Run/Match* → ShadowLedgerCheck → AutoResolvePendingExceptions`. Workers wire dependencies via the registry pattern already used.

Cron strategy: extend the existing polling fleet with an internal "should fire today" / "should fire this hour" gate inside each daily/hourly job, mirroring `apps/workers/src/modules/period-close.ts`. The worker runtime is interval-only (§1.5); introducing a cron component is out of scope.

---

## 11. Database migrations

Single migration generated via `bun run db:generate` after the schema changes are wired into `apps/db/src/schema-registry.ts`. Per CLAUDE.md the policy is **baseline-only hard cutover**: `db:nuke && db:migrate && db:seed`. No legacy data migration required.

Contents:

* New tables: `reconciliation_provider_report_files`, `reconciliation_provider_movements`, `reconciliation_provider_balance_snapshots`, `reconciliation_bank_documents`, `reconciliation_bank_statement_entries`, `reconciliation_resolutions`, `reconciliation_tolerance_rules`, `reconciliation_provider_cursors`, `reconciliation_settlement_calendar`, `reconciliation_movement_links`.
* New enums (`@bedrock/platform/persistence` style — Drizzle pgEnum):
  * `reconciliation_exception_state` (extend with `in_review`, `escalated`).
  * `reconciliation_exception_type` (full §6 list including `shadow_balance_mismatch`, `bank_entry_booking_lag`, `transitive_mismatch`, `multi_hop_mismatch`, `late_provider_balance_snapshot`, `unknown_provider_movement_type`, `chargeback_fee_mismatch`).
  * `reconciliation_match_status` (extend with `partial`, `duplicate`).
  * `reconciliation_run_kind` (`internal_to_provider`, `provider_to_provider`, `provider_to_bank`, `bank_to_internal`, `deal_scoped`, `full`, `backfill`).
  * `reconciliation_run_mode` (`live`, `dry_run`, `rerun`, `incremental`, `full_period_rebuild`).
  * `reconciliation_resolution_action` and `reconciliation_resolution_reason` per §7.
  * `reconciliation_movement_type` per §3.
* New columns on existing tables:
  * `reconciliation_runs.kind`, `mode`, `lock_key`, `metrics`, `scope_filter`.
  * `reconciliation_matches.match_kind`, `confidence` (`numeric(5,4)` for indexable filtering), `match_group_id`.
  * `reconciliation_exceptions.exception_type`, `severity`, `assigned_to`, `due_at`.
* Indices and uniques: as listed per table in §2.
* FKs: `parties.requisites`, `files.fileAssets`, `files.fileVersions`, `documents`, `ledger.ledgerOperations`, `treasury.paymentSteps`, `iam.users`.

Rollout: forward-only. Avoid downtime by following AGENTS.md migration ordering (add columns nullable, backfill in code, then enforce — though for cutover policy this is academic).

---

## 12. Testing strategy

Unit tests (Vitest project `reconciliation`):

* Parsers: table-driven cases per provider/format. Fixture files under `packages/modules/provider-stripe/tests/fixtures/`, etc.
* Canonical movement Zod parsing: golden tests of "raw → canonical".
* Idempotency: two-pass import asserts identical row count + `(provider, provider_record_id)` invariants.
* Duplicate detection: identical checksums + identical `provider_record_id` produce no new rows.
* Matching rules: table-driven `(externalRecord, internalCandidates) → expected match status + confidence`.
* Tolerance rules: table-driven `(amount, tolerance, currency) → within | not`.
* Exception creation: scenarios per exception type.
* Manual resolution: state machine table — every legal transition tested, every illegal transition asserted to throw.
* Reconciliation re-runs: assert auto-resolution of previously open exceptions, no duplicate matches.
* Multi-currency cases: bank credit in EUR matching internal payment in USD via `quoteExecutions` — produce `fx_mismatch` if rate differs.
* Partial matches: exactly one candidate at score 0.7 → `partial_match`.
* Ambiguous matches: two candidates at score 0.85 each → `duplicate_match_candidate`.
* Delayed events: re-run after T+5 days finds match and auto-resolves.
* Concurrency: lock-key tests assert second run is rejected; advisory-lock fault injection tested.

Integration tests (Vitest project `reconciliation:integration`):

* End-to-end: ingest fixture file → matches → exceptions visible in API.
* Schema round-trip: insert + select with all new columns/enums.
* Worker: existing `tests/integration/worker.test.ts` extended.

Fixtures: extend `packages/tooling/test-utils/src/fixtures.ts` with `TEST_PROVIDER_REPORTS`, `TEST_BANK_DOCUMENTS` deterministic UUIDs.

---

## 13. Observability

### 13.1 Metrics (Prometheus, via existing `@bedrock/platform/observability`)

```
reconciliation_runs_total{kind,source,result}
reconciliation_run_duration_seconds{kind,source}                  # histogram
reconciliation_exceptions_total{type,severity,source}
unresolved_exceptions_total{state,severity,source}                # gauge
auto_matched_movements_total{kind,source}
manual_resolutions_total{action,reason}
unmatched_bank_entries_total{currency}                            # gauge
unmatched_provider_movements_total{provider,currency}             # gauge
amount_mismatch_total{source,direction}
import_failed_total{kind,source}
provider_report_files_ingested_total{provider,kind}
bank_documents_ingested_total{format}
shadow_balance_drift_minor{provider,account,currency}             # gauge — last absolute drift
shadow_balance_mismatch_total{provider,account,currency}
transitive_chain_breaks_total{from_kind,to_kind}
match_confidence_bucket_total{bucket=lt070|lt095|gte095, direction}
late_event_lag_seconds{kind,source,quantile}                      # summary
provider_balance_snapshot_freshness_seconds{provider,account}     # gauge — now − last as_of
```

### 13.2 Structured log fields (Pino)

```
svc, runId, source, sourceKind, externalRecordId, providerRecordId,
bankDocumentId, bankEntryId, exceptionId, matchId, runKind, runMode,
correlationId, traceId, causationId, requestId,
amountMinor, currencyCode, occurredAt, score
```

Use `logger.child({ svc: "reconciliation", runId })` per run.

### 13.3 Alerts

* `unresolved_exceptions_total{severity="critical"} > 0` for > 30 min.
* `import_failed_total` rate > 0.
* `reconciliation_run_duration_seconds_p95` > SLO.
* No successful run in last 25 hours per `(kind, source)`.

---

## 14. Security, audit, and compliance

### 14.1 Permissions

* **Imports** (provider report upload, bank document upload): permission `reconciliation:import`. Recommend role: `admin` only initially (NEEDS_DECISION).
* **Resolution / matching**: `reconciliation:resolve`, `reconciliation:match` — `admin`, `finance`.
* **Listing**: `reconciliation:list` — `admin`, `finance`, `agent` (read-only triage).
* **Idempotency keys** at API layer prevent replay attacks for resolution actions.

### 14.2 Audit (SOX-class trail)

Every state change writes `reconciliation_resolutions(actor_user_id, action, payload, correlation_id, created_at_app, audit_timestamp_db)` where:

* `action` is a closed-set enum.
* `created_at_app` is set in TypeScript (`new Date()` at handler entry).
* `audit_timestamp_db` is `default now()` populated by Postgres — defends against application-clock drift.
* The table is **append-only**: `UPDATE` and `DELETE` are revoked at the role level for non-admin DB users; the column `actor_user_id` is a hard FK to `iam.users.id` and never deleted (deactivation only).
* Period-close interaction: `reconciliation_exceptions` rows in state `open|in_review|escalated` for any `value_date` inside the closing period **block** the period close (NEEDS_DECISION confirms; recommended yes).

### 14.3 GAAP / IFRS attribution

* For period-close reporting, only matches where `confidence ≥ 0.95` AND no contradiction penalty fired AND status is `matched` count as **fully reconciled**.
* `partial` and manual matches with `confidence < 0.95` require a `reviewed_by_user_id` and `reviewed_at` fields on `reconciliation_matches`. Add these in Phase 5.
* Cross-period adjustments use the existing `documents` flow → `document-posting` workflow → `ledger.ledgerOperations`. Reconciliation never posts directly to the ledger.

### 14.4 PCI / sensitive data

* **PAN-like data**: settlement reports may include masked card tails or scheme references. Treat any field that looks like a card number (Luhn-valid, 13–19 digits) as sensitive: never log, never index in plaintext.
* **IBAN handling**: store full IBAN in `bank_statement_entries.counterparty_iban` (required for matching), but in API responses default to **last-4 masking** for users without `parties:read_full_requisite`. Apply the same masking in any export.
* **Hashed indexes**: `end_to_end_id` and `bank_reference` are stored both raw (for human triage) and as `*_hash text` (sha256) for search joins that must avoid plaintext indexes when a strict policy is set. NEEDS_DECISION: enable per-deployment or always-on.
* **Logs**: log structured fields only (`bank_entry_id`, `external_record_id`, masked amounts in major units, currency). Never log raw rows, IBAN in full, or counterparty names by default. Pino redaction is configured globally — extend redaction paths if necessary.
* **Raw blobs (S3)**: encryption at-rest with SSE-S3 minimum; SSE-KMS strongly recommended. NEEDS_DECISION: per-organization KMS keys or single key. Signed URLs must be ≤ 5 min and tied to the requesting user.

### 14.5 Data lifecycle

* Raw provider/bank files: retain 7 years (regulatory baseline), then purge from S3 — file metadata rows stay forever (cheap) for trace continuity.
* `reconciliation_external_records.rawPayload` is denormalized from S3; an annual job can null out rows whose `received_at` is > retention if storage pressure justifies.

---

## 15. Phased implementation plan

Per phase: G=goal, T=tasks, F=files / modules touched, N=new files / modules, R=risks, X=tests, A=acceptance.

### Phase 1 — Data model and immutable imports

* G: Land all new tables + raw file ingestion endpoints. No matching changes.
* T:
  * Extend `packages/modules/reconciliation/src/infra/drizzle/schema/index.ts` with all new tables/columns/enums (§2, §11).
  * Extend `apps/db/src/schema-registry.ts` to register new tables.
  * Generate migration: `bun run db:generate`.
  * Add upload endpoints `POST /reconciliation/imports/provider-reports`, `POST /reconciliation/imports/bank-documents` storing raw via `@bedrock/files` and creating header rows. Echo the multipart pattern in `apps/api/src/routes/agreements.ts` and the §4.4 example.
  * Wrap every mutating handler with `withIdempotencyTx({ scope: ... })` per §1.12. Add scope strings: `recon.ingestProviderReport`, `recon.ingestBankDocument`.
  * Extend `createReconciliationService` facade with a new `imports` namespace: `{ ingestProviderReport, ingestBankDocument }`.
* F: `apps/api/src/routes/`, `apps/db/migrations/`, `packages/modules/reconciliation/src/{contracts,application,infra}/...`.
* N: `packages/modules/reconciliation/src/application/imports/{ingest-provider-report,ingest-bank-document}.ts`, `apps/api/src/routes/reconciliation.ts`.
* R: schema explosion; missing FK direction. Mitigation: review with one Plan-agent pass before generating migration. Also: do not break existing `treasury_instruction_outcomes` source — confirm via the existing `worker.test.ts` integration test.
* X: integration: upload flow round-trip; idempotent re-upload returns existing row; existing reconciliation tests still green.
* A: `bun run check-types && bun run build && bun run test:integration --project reconciliation:integration` green; running upload twice produces one DB row; `bun run check:boundaries` green.

### Phase 2 — Provider movement normalization

* G: Stripe / Adyen / Wise parsers turning raw files into canonical movements + `provider_movements` rows + `external_records` rows.
* T:
  * Create `packages/modules/provider-stripe/`, `provider-adyen/`, `provider-wise/` with `parseReport(buffer, kind)` exports. Use vendor-agnostic Zod canonical movement.
  * `NormalizeProviderMovementsJob` worker.
  * Mapping tests with fixture files.
* N: above three packages + worker.
* R: parser correctness. Mitigation: golden fixtures committed under `tests/fixtures/`; small but real samples (or anonymized).
* X: per-provider parser tests (table-driven, edge cases: refunds, FX legs, payouts, adjustments).
* A: ingest a fixture file → expected `provider_movements` rows materialize; `external_records` populated; `bun run check:boundaries` green.

### Phase 3 — Bank statement normalization

* G: CAMT.053 + MT940 + per-bank CSV parsers; `bank_statement_entries` rows; `bank_documents.opening/closing_balance_minor` populated.
* T: parser packages, `NormalizeBankStatementEntriesJob`. Add `is_treasury_account` flag (or wrap-table per Open Question 1) to `parties.requisites` so a statement can target an organization-owned bank account.
* N: `packages/modules/bank-statement-parsers/`.
* R: format zoo. Mitigation: start with one bank's CAMT.053; CSV optional.
* X: golden fixtures per format.
* A: ingest fixture statement → entries materialize, opening + sum(entries) = closing exactly. CAMT.054 reserved for a v1.1 follow-up.

### Phase 4 — Basic matching engine

* G: Four matchers (`internal_to_provider`, `provider_to_provider`, `provider_to_bank`, `bank_to_internal`) with strategies 1–4 from §5.2 (no tolerance fuzzy match yet); produce `matched|unmatched|ambiguous`.
* T:
  * Domain functions: one per direction in `domain/matchers/<direction>.ts` — pure, take candidate sets, return `MatchResolution[]`.
  * Wire into the existing `runReconciliation` handler keyed off `runs.kind`. Default kind for the existing source `treasury_instruction_outcomes` stays `internal_to_provider` so behaviour is unchanged.
  * Update `ReconciliationLedgerLookupPort` with `findPaymentStepByProviderRef`, `findPaymentStepByMerchantRef`, `findPayoutAggregate`, `findPaymentStepByBankCounterparty`.
  * Use `PendingSources` (§1.12) as the incremental driver.
* F: `packages/modules/reconciliation/src/domain/matching.ts`, `application/runs/...`, ports.
* N: per-direction matcher files.
* R: silent regressions on existing deal-scoped matcher. Mitigation: source-keyed dispatch; existing tests stay green.
* X: table-driven matching tests; existing reconciliation tests still pass.
* A: a known fixture flows end-to-end and lands in the correct match status.

### Phase 5 — Tolerance, conditional confidence, exception taxonomy

* G: Strategies 5–7, the conditional scoring pipeline (§5.4), full exception types (§6).
* T:
  * `MatchTolerance` domain object + `reconciliation_tolerance_rules` queries (with amount-band scoping).
  * Replace the matcher's binary decision with the conditional scoring pipeline.
  * Exception type derivation per (direction, evidence, candidate set).
  * Add `confidence` numeric + `match_kind` columns to `reconciliation_matches` and `reviewed_by_user_id`/`reviewed_at` for sub-0.95 matches (§14.3).
  * Settlement calendar table + helper `businessDaysBetween(d1, d2, scope)`.
* X: table-driven tolerance + scoring tests covering every contradiction penalty; per-exception-type creation tests; "score never exceeds 0.5 when amount disagrees" invariant.
* A: fuzz fixtures hit each exception type at least once; auto-resolve fires only at score ≥ 0.95 with no contradictions.

### Phase 6 — Manual resolution workflow

* G: Endpoints + UI for treasury queue. Resolutions table populated.
* T:
  * Implement endpoints from §7.2 (treasury queue subset).
  * Implement UI screens from §7.3 in `apps/finance/`.
  * Wire `reconciliation_resolutions` writes from every state-changing handler.
* F: `apps/api/src/routes/reconciliation.ts`, `apps/finance/features/treasury/reconciliation/...`.
* X: manual match → exception resolved + resolution row appended; ignore/escalate/comment paths covered.
* A: treasury user can clear an exception end-to-end via UI.

### Phase 7 — Scheduled reconciliation runs

* G: Daily/full + per-source/per-account scheduled runs. Locking. Modes.
* T:
  * Extend worker fleet with `RunDailyReconciliationJob` using the period-close "should-fire-today" gate pattern (§1.5).
  * Implement run modes (`live | dry_run | rerun | incremental | full_period_rebuild`).
  * Implement two-layer locking: `reconciliation_runs.lock_key` partial unique index + new `packages/platform/src/persistence/advisory-lock.ts` (`pg_try_advisory_xact_lock(hashtext($1))`).
  * Cutoff-time gating: a run for period P is skipped until the latest report cutoff for the source family has passed.
* X: concurrency tests (two parallel runs against the same scope_key — second returns `locked_out`); dry-run produces no writes; rerun resolves a previously open exception.
* A: a daily run executes at the configured hour, produces metrics, and flips eligible exceptions to resolved.

### Phase 8 — Provider-specific improvements + shadow ledger + transitive matching

* G: payout-batch matching, FX-mismatch detection, fee-mismatch detection, status-mismatch detection, **balance-snapshot ingest, shadow-ledger check, transitive provider→provider chains** (§3.4–§3.5).
* T:
  * Per-provider mapping refinements; integrate `calculations.provider_fee_expense` lookup; FX rate cross-check via `fx.fxRates`.
  * `IngestProviderBalanceSnapshotJob` polling each provider's balance API (or pulling from balance reports) into `reconciliation_provider_balance_snapshots`.
  * `ShadowLedgerCheckJob` running per `(source, account, currency, period)` after every run completes.
  * `domain/transitive-match.ts` and `reconciliation_movement_links` writes from a new `provider_to_provider` matcher.
* X: per-provider scenario fixtures; fixture with a deliberate missing movement that the shadow check catches; transitive chain spanning Stripe→Wise→bank.
* A: `provider_fee_mismatch`, `fx_mismatch`, `status_mismatch`, `shadow_balance_mismatch`, `transitive_mismatch`, `multi_hop_mismatch` all reachable in tests.

### Phase 9 — Bank/accounting export

* G: Export endpoints + jobs (`ExportReconciliationReportJob`); CSV/JSON outputs.
* T: implement `GET /reconciliation/exports/run/{id}.csv`; signed file storage in `files`.
* X: snapshot tests for exported CSV.
* A: export downloadable, deterministic.

### Phase 10 — Observability and hardening

* G: Metrics, alerts, runbook, security review pass.
* T: add Prometheus metrics, alerts, log fields. Run `simplify` skill on the new code. Run `security-review` skill on the diff.
* X: smoke metric tests; alert rule lint.
* A: green CI; runbook in `docs/`; alerts wired.

---

## 16. Output format

This file is the deliverable. No code, migrations, or behavior changes have been written. Implementation proceeds phase by phase per §15.

---

## Open Questions

### Domain / product

1. **Bank account modeling.** Today `parties.requisites` covers bank accounts but has no "this is *our* treasury account" marker. Should we add `is_treasury_account boolean` to organization-owned requisites, or introduce a new `organization_bank_accounts` table that wraps a requisite?
2. **Reserve hold / release modeling.** No internal table represents reserves today. Do we need one, or do we treat reserves as opaque provider events that never match an internal counterpart?
3. **Treasury role.** Keep `finance` as the umbrella role for treasury actions, or introduce a dedicated `treasury` role?
4. **Scope of `reconciliation:import`.** Admin-only or also `finance`?
5. **Provider account model.** Multiple Stripe accounts? Multi-org multi-provider? Add a `provider_accounts` table now or defer?
6. **Late-event SLA.** What is the business-defined "this should have settled by now" SLA per provider? Drives `late_match_threshold_days`.
7. **Tolerance defaults.** What absolute / bps tolerances are acceptable per provider for fees and FX deltas? (Often comes from the provider's contract — and may need amount-band scoping.)
8. **Settlement currency normalization.** When a provider settles in EUR and our internal payment is in USD, how do we book the FX delta — separate `fx_difference` postings or absorb into a margin account?
9. **Bank statement format priority.** CAMT.053 first, MT940 second, bank CSVs third — or a different order driven by which banks the treasury actually uses?
10. **CAMT.054 push handling.** Same parser pipeline + `bank_documents` rows of format `CAMT.054`? Or a separate notification table that is later reconciled against the end-of-day CAMT.053?
11. **Webhook adoption.** Wire Stripe / Adyen webhooks for *operational* state hints (e.g. flip `paymentStep.state`), keeping reports as the source of truth for reconciliation? This adds Phase 2 work if yes.
12. **Existing source `treasury_instruction_outcomes`.** What exactly produces these records today? The plan keeps the source intact, but the producer is UNKNOWN.
13. **Period-close interaction.** Block `period_close` when critical exceptions exist for that period? §14.2 recommends yes.
14. **Multi-org isolation.** Are reconciliation runs / exceptions strictly scoped to one organization, or shared? Affects every query's `organization_id` filter.
15. **Settlement style per bank.** Net (one summary entry per day) vs gross (one entry per movement) — should the bank-document ingest carry a `settlement_style` flag that changes how `provider_to_bank` aggregates?

### Compliance / security

16. **Encryption of raw files.** S3 SSE-S3 vs SSE-KMS with per-org keys.
17. **PII masking on bank entries.** What level of IBAN masking is required for non-admin users? Hash-only indexes on `end_to_end_id` and `bank_reference` always-on or per-deployment?
18. **PCI surface.** Do any provider settlement reports we will receive include PAN tails or scheme-level identifiers that escalate the deployment into PCI-DSS scope?
19. **Audit retention.** Is the proposed 7-year raw-file retention correct for the operating jurisdictions? (EU vs US vs UAE diverge.)

### Integrations / external sources

20. **Adyen Settlement Details enum.** Public docs are not exhaustive; the parser must be validated against a real tenant fixture before Phase 2 ships.
21. **Wise statement movement taxonomy.** Public Wise docs do not enumerate movement types; the parser may need to infer types heuristically from descriptions until Wise confirms a taxonomy.
22. **Settlement / holiday calendar source.** TARGET2 for EUR, US Fed for USD — which library/feed do we pull, and how often?

### Confidence / matching policy

23. **Auto-resolve threshold.** §5.4 sets 0.95. Sign off with finance / audit before enabling auto-resolve in production.
24. **Reviewer sign-off requirement.** Should `partial` matches (`0.70 ≤ s < 0.95`) require a *second* reviewer for SOX-sensitive deployments (maker-checker)?

### Platform infrastructure

25. **Advisory lock helper location.** Add `withAdvisoryLock` to `@bedrock/platform/persistence` or to a new `@bedrock/platform/concurrency` subpath?
26. **Source registry.** Free-form `source` string (status quo) or an enum / registry table that validates each source on ingest?

<!-- last-synced: pending — set after first refresh per CLAUDE.md protocol -->
