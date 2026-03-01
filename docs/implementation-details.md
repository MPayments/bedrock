# Implementation Details

Last updated: 2026-03-01

## Purpose

This document is an implementation inventory of the current runtime.
It reflects the post-cutover payment architecture in code now.

## Runtime and Workspace Conventions

### Monorepo layout

Root workspaces:

- `apps/*`
- `packages/platform/*`
- `packages/modules/*`
- `packages/packs/*`
- `packages/sdk/*`
- `packages/tooling/*`

### Runtime model

- Bun is package manager and script runner
- Node.js 24.x is application runtime
- Turborepo coordinates build/check/test pipelines

### Service pattern

Services and workers use closure factories:

- `createXxxService(...)`
- `createXxxWorker(...)`
- `createXxxHandler(...)`

## API Adapter (`apps/api`)

### Composition

`apps/api/src/composition/platform.ts` wires shared platform services:

- `accountingService`
- `balancesService`
- `ledger` engine
- `ledgerReadService`
- `logger`

`apps/api/src/composition/modules.ts` wires module-level services:

- operational accounts
- accounting reporting
- counterparties/customers/currencies
- fees/fx
- connectors
- orchestration
- payments
- documents (internal runtime use)
- reconciliation
- module runtime governance (`@bedrock/module-runtime`)

Document registry in API composition currently registers only:

- `payment_intent` (`createPaymentIntentDocumentModule`)
- `payment_resolution` (`createPaymentResolutionDocumentModule`)

### Mounted `/v1` modules

From `apps/api/src/modules/registry.ts`, mounted route groups are:

- `/v1/accounting`
- `/v1/account-providers`
- `/v1/accounts`
- `/v1/balances`
- `/v1/counterparties`
- `/v1/counterparty-groups`
- `/v1/customers`
- `/v1/currencies`
- `/v1/payments`
- `/v1/connectors`
- `/v1/orchestration`
- `/v1/fx/rates`
- `/v1/reconciliation`
- `/v1/system/modules`

All modules are mounted unconditionally.
Enable/disable behavior is enforced at request execution time through module guards.

`/v1/docs` is not mounted.

### Payment cutover route details

#### `/v1/payments`

- `GET /` list payments (`kind=intent|resolution|all`, pagination)
- `POST /` create payment intent draft
- `GET /:id`
- `GET /:id/details` aggregated view (document + connector intent + attempts + events)
- `POST /:id/submit`
- `POST /:id/approve`
- `POST /:id/reject`
- `POST /:id/post`
- `POST /:id/cancel`

#### `/v1/connectors`

- `GET /providers` list provider health
- `PUT /providers/:providerCode` upsert provider health
- `GET /attempts`
- `GET /events`
- `POST /providers/:providerCode/statements/ingest`
- `POST /providers/:providerCode/webhook`

Webhook flow:

- adapter verifies/parses payload
- service writes idempotent connector event mutation
- terminal status (`succeeded`/`failed_terminal`) triggers payment resolution draft+post path

#### `/v1/orchestration`

- routing rules CRUD (`/`)
- corridors CRUD (`/corridors`)
- fee schedules CRUD (`/fees`)
- limits CRUD (`/limits`)
- scope overrides CRUD (`/overrides`)
- `POST /simulate` route simulation

### Middleware and cross-cutting behavior

- all `/v1/*` requires auth session
- permission checks are route-level (`requirePermission`)
- request context carries correlation IDs and idempotency key
- non-create mutating payment actions require `Idempotency-Key`
- JSON serialization for new payment/connectors/orchestration routes uses `toJsonSafe(...)` for `bigint` and `Date`

### Permission resources

Permission model includes resources:

- `payments`
- `connectors`
- `orchestration`

Legacy payment-surface permissions tied to old flow contracts are not used by mounted payment routes.

## Connectors Runtime (`@bedrock/connectors`)

### Package layout

- `src/service.ts`
- `src/internal/context.ts`
- `src/internal/status.ts`
- `src/validation.ts`
- `src/errors.ts`
- `src/commands/*`
- `src/workers/*`
- `src/index.ts`

### Provider adapter contract

`ConnectorAdapter` methods:

- `initiate(...)`
- `getStatus(...)`
- `verifyAndParseWebhook(...)`
- `fetchStatements(...)`

### Service surface

Core commands exposed:

- `createIntentFromDocument`
- `enqueueAttempt`
- `recordAttemptStatus`
- `handleWebhookEvent`
- `ingestStatementBatch`
- `markIntentTerminal`

Query/operational methods exposed:

- intent/attempt/event reads
- health reads/writes
- worker claim helpers for dispatch/poll/statement loops

### State model

Intent statuses:

- `planned`
- `in_progress`
- `succeeded`
- `failed`
- `cancelled`

Attempt statuses:

- `queued`
- `dispatching`
- `submitted`
- `pending`
- `succeeded`
- `failed_retryable`
- `failed_terminal`
- `cancelled`

## Orchestration Runtime (`@bedrock/orchestration`)

### Package layout

- `src/service.ts`
- `src/internal/context.ts`
- `src/commands/route.ts`
- `src/commands/config.ts`
- `src/worker.ts`
- `src/validation.ts`
- `src/errors.ts`

### Runtime behavior

- route planning filters by direction/corridor/currency/country/amount/risk
- provider eligibility pruned by corridor support and limits
- scoring includes fee/FX/SLA/health components
- deterministic ordering:
  - score desc
  - rule priority
  - provider code lexicographic
- per-book override support through `orchestration_scope_overrides`

### Service surface

- `planRoute`
- `simulateRoute`
- `selectNextProviderForIntent`
- `recordAttemptOutcome`
- routing config CRUD handlers (rules/corridors/fees/limits/overrides)

## Payments Module (`@bedrock/payments`)

### Public exports

- `createPaymentsService`
- `createPaymentIntentDocumentModule`
- `createPaymentResolutionDocumentModule`
- payment payload schemas/types

### Document types

`payment_intent`:

- direction (`payin|payout`)
- source/destination operational accounts
- amount/currency/corridor
- optional provider/risk metadata

`payment_resolution`:

- `intentDocumentId`
- `resolutionType` (`settle|void|fail`)
- provider event idempotency linkage
- optional external ref

### Service behavior

`createPaymentsService` orchestrates:

- draft/list/get/details actions for payment documents
- workflow transitions (`submit|approve|reject|post|cancel`)
- on `post`: connector intent creation + orchestration route + first attempt enqueue
- resolution document creation and posting

## Workers Adapter (`apps/workers`)

### Registered loops

- `ledger`
- `documents`
- `balances`
- `fx-rates`
- `reconciliation`
- `connectors-dispatch`
- `connectors-poller`
- `connectors-statements`
- `orchestration-retry`

Loops are always registered. Each loop checks module enablement at execution time.

### New interval env vars used

- `CONNECTORS_DISPATCH_WORKER_INTERVAL_MS`
- `CONNECTORS_STATUS_POLLER_INTERVAL_MS`
- `CONNECTORS_STATEMENT_INGEST_INTERVAL_MS`
- `ORCHESTRATION_WORKER_INTERVAL_MS`

Module runtime polling/listen parameters currently use in-code defaults:

- epoch poll interval: `5000ms`
- cache TTL fallback: `30000ms`

Monitoring (`apps/workers/src/monitoring.ts`) tracks all loops and exposes:

- `/health`
- `/metrics`
- `/`

## Database Schema and Migration

### New connectors tables

- `connector_payment_intents`
- `payment_attempts`
- `connector_events`
- `connector_references`
- `connector_health`
- `connector_cursors`

Key invariants/indexes implemented:

- unique `connector_payment_intents(document_id)`
- unique `payment_attempts(intent_id, attempt_no)`
- unique `connector_events(provider_code, webhook_idempotency_key)`
- unique `connector_references(provider_code, ref_kind, ref_value)`
- claim indexes for dispatch/polling loops in `payment_attempts`

### New orchestration tables

- `routing_rules`
- `provider_corridors`
- `provider_fee_schedules`
- `provider_limits`
- `orchestration_scope_overrides`

### Migration artifacts

- `packages/platform/db/migrations/0001_clean_slayback.sql`
- `packages/platform/db/migrations/meta/0001_snapshot.json`

### Seeds

Orchestration baseline seed is implemented in:

- `packages/platform/db/src/seeds/orchestration.ts`

`run-all` now includes this seed step.

## Idempotency Scopes

Added scopes:

- `connectors.createIntent`
- `connectors.enqueueAttempt`
- `connectors.recordAttemptStatus`
- `connectors.handleWebhook`
- `connectors.ingestStatements`
- `connectors.markIntentTerminal`
- `orchestration.route`
- `orchestration.retrySchedule`

## Module Runtime (`@bedrock/module-runtime`)

### Core behavior

- code-defined manifests are source of truth
- strict DAG validation at startup
- effective state precedence: `book override -> global override -> manifest default`
- mutable module state in DB with audit trail
- serialized updates via `pg_advisory_xact_lock`
- epoch invalidation on state updates via `pg_notify('module_state_changed', epoch)`
- LISTEN/NOTIFY cache invalidation with poll fallback

### Storage

- `platform_module_states`
- `platform_module_events`
- `platform_module_runtime_meta`

### API

- `GET /v1/system/modules`
- `GET /v1/system/modules/:moduleId/effective`
- `PUT /v1/system/modules/:moduleId/state`
- `GET /v1/system/modules/events`
- `GET /v1/system/modules/runtime`

Disabled modules return `503 MODULE_DISABLED` with `Retry-After`.

## Web Payment Surface

Payment pages now include dedicated API integration:

- `apps/web/features/payments/lib/api.ts` uses `/v1/payments`
- orders page shows `payment_intent` list
- settlements page shows `payment_resolution` list
- order details page shows connector intent, attempts, and provider events

## Tests and Quality Gates Applied

### API route tests updated

Legacy docs-route test removed and replaced with:

- `apps/api/tests/routes/payments.test.ts`
- `apps/api/tests/routes/connectors.test.ts`
- `apps/api/tests/routes/orchestration.test.ts`

### Verification executed

- monorepo `check-types`
- `vitest` unit matrix (`bun run test`)
- API build (`bun run build --filter=api`)

## Removed/Inactive Legacy Payment Behavior

No longer part of active payment runtime:

- public `/v1/docs` payment workflow contract
- legacy treasury payment-case route model
- compatibility adapters/shims for old payment contracts
- dual runtime path for payment execution

Legacy packages can still exist in repository, but they are not registered in current API payment flow composition.
