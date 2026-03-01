# Bedrock Architecture

Last updated: 2026-03-01

## Purpose

This document describes the architecture implemented in this repository now.
It is descriptive, not aspirational.

When this document and code diverge, source of truth order is:

1. `apps/*`
2. `packages/*`
3. `packages/platform/db/src/schema/*`

## Current Architecture (Post-Cutover)

Bedrock payment runtime is now built on two first-class platform layers:

- `@bedrock/connectors` for provider integration runtime
- `@bedrock/orchestration` for routing, retries, and fallback planning
- `@bedrock/module-runtime` for plugin/module governance (state, guards, dependency policy)

Hard cutover principles reflected in code:

- No compatibility adapters for legacy payment runtime behavior
- No dual-write payment flow
- `/v1` kept as API version, but payment contracts replaced in place
- `documents` remains workflow source of truth, but public payment surface is no longer generic `/v1/docs`

## System Summary

Bedrock is a Turborepo monorepo with:

- `apps/api` as authenticated Hono API adapter
- `apps/workers` as background processing adapter
- `apps/web` as Next.js frontend
- `packages/platform/*` as reusable runtime subsystems
- `packages/modules/*` as business/domain modules
- `packages/packs/*` as accounting pack definitions

Operational stack:

- Bun for package management and scripts
- Node.js 24.x as runtime
- PostgreSQL as primary system of record
- TigerBeetle for ledger execution

## Layer Model

Dependency direction is inward:

```text
apps/* -> packages/modules/* -> packages/platform/* -> packages/packs/*
```

Responsibilities:

- Adapters (`apps/*`) own transport/auth/process concerns
- Modules own domain workflows
- Platform packages own runtime mechanics (documents, ledger, balances, connectors, orchestration)
- Packs own accounting template semantics

## Architectural Principles

### 1. Closure factories, not classes

Services and workers are built as `createXxx(...)` closure factories.

### 2. Documents are workflow source of truth

Workflow state lives in `documents` and related document tables.
Payment execution state is projected into dedicated connector/orchestration tables linked to documents.

### 3. Provider runtime is explicit

`@bedrock/connectors` standardizes:

- intent creation from posted payment documents
- attempt queueing and dispatch
- webhook ingestion with idempotent mutation
- polling for non-webhook rails
- statement ingestion with cursors

### 4. Routing runtime is explicit

`@bedrock/orchestration` provides deterministic:

- provider candidate selection
- cost/FX/SLA/health scoring
- tie-breaking
- retry/fallback scheduling
- per-book override application

### 5. Execution remains asynchronous

Durable acceptance happens first.
External side effects and state convergence are completed via worker loops.

## Runtime Planes

### API and auth plane

Implemented in `apps/api`.
Owns auth, permission checks, request-context propagation, and route composition.

### Workflow plane

Implemented by `@bedrock/documents` + payment document modules from `@bedrock/payments`:

- `payment_intent`
- `payment_resolution`

### Connectors plane

Implemented by `@bedrock/connectors`.
Owns provider attempts/events/references/health/cursor state.

### Orchestration plane

Implemented by `@bedrock/orchestration`.
Owns routing rules, provider corridor coverage, fee/limit models, and overrides.

### Financial execution plane

Implemented by:

- `@bedrock/accounting`
- `@bedrock/ledger`
- `@bedrock/balances`

### Reconciliation plane

Implemented by `@bedrock/reconciliation`.
Consumes external records and matching lifecycle.

### Module governance plane

Implemented by `@bedrock/module-runtime`.
Owns runtime module state (`global` + `book`), dependency validation, and execution guards.

## Payment Lifecycle

Current end-to-end flow:

1. Client creates `payment_intent` via `/v1/payments`.
2. Workflow transitions (`submit/approve/reject/post/cancel`) are invoked through `/v1/payments/:id/*`.
3. On `post`, payment service:
   - posts pending ledger entries through documents/accounting/ledger runtime
   - creates connector intent linked to payment document
   - requests route from orchestration
   - enqueues first provider attempt
4. Connectors workers dispatch and/or poll attempts.
5. Provider webhooks are verified and applied idempotently to connector state.
6. Terminal provider outcomes produce `payment_resolution` documents and final posting path.

## API Surface

Authenticated route groups under `/v1`:

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

Public payment runtime is now:

- `/v1/payments`
- `/v1/connectors`
- `/v1/orchestration`

`/v1/docs` is not mounted as a public route.

Non-business top-level routes:

- `/` health
- `/api/auth/*` Better Auth
- `/api/open-api` OpenAPI
- `/docs` Scalar UI

## Worker Topology

Worker loops currently running:

- `ledger`
- `documents`
- `balances`
- `fx-rates`
- `reconciliation`
- `connectors-dispatch`
- `connectors-poller`
- `connectors-statements`
- `orchestration-retry`

Worker loops are registered at startup regardless of enabled state.
Execution is guarded per tick by module runtime state resolution.

Monitoring endpoints:

- `/health`
- `/metrics`
- `/`

## Storage Model

Major table families:

- Auth: `user`, `session`, `account`, `verification`
- Reference/master data: `books`, `currencies`, `customers`, operational account and counterparty tables
- Documents: `documents`, `document_events`, `document_links`, `document_operations`, `document_snapshots`
- Idempotency: `action_receipts`
- Accounting: chart/policy/correspondence/pack tables
- Ledger: `ledger_operations`, `postings`, `tb_transfer_plans`, `outbox`, `book_account_instances`
- Balances: `balance_positions`, `balance_holds`, `balance_events`, `balance_projector_cursors`
- Connectors: `connector_payment_intents`, `payment_attempts`, `connector_events`, `connector_references`, `connector_health`, `connector_cursors`
- Orchestration: `routing_rules`, `provider_corridors`, `provider_fee_schedules`, `provider_limits`, `orchestration_scope_overrides`
- Reconciliation: external records/runs/matches/exceptions
- FX/Fees: rate/source/quote/fee component tables

## Boundaries and Non-Goals

Active architecture intentionally excludes legacy public payment behavior:

- no legacy payment-case public API contracts
- no `/v1/docs` payment workflow contract
- no compatibility shims for old payment endpoints
- no dual runtime payment path

Additional boundaries:

- `documents` service is still used internally by payments and reconciliation flows
- legacy packages may remain in repository, but cutover payment runtime is connectors + orchestration + payment document modules
