# Bedrock Full Cutover Plan: Connectors + Orchestration (No Backward Compatibility)

## Summary
This plan delivers a complete, end-state fintech runtime in Bedrock by adding and fully integrating:
1. `@bedrock/connectors` as the provider integration runtime.
2. `@bedrock/orchestration` as the routing/retry/fallback runtime.

Hard constraints locked:
- No backward compatibility.
- Hard reset cutover (greenfield runtime data).
- Keep documents as primary workflow source.
- Keep current API versioning and break `/v1` in place.

End state:
- Treasury payment flows are rebuilt on top of connectors + orchestration.
- Legacy treasury payment flow contracts are removed.
- `/v1` payment surfaces are replaced with new contracts.
- Worker topology includes full dispatch, polling, statement ingest, and orchestration loops.
- Web/API/SDK/docs/tests are fully aligned with the new model.

## End-State Architecture Decisions

### 1. Primary Aggregates
- `documents` remains the workflow source of truth.
- New connector intent/attempt state is persisted in dedicated connector tables and linked to documents.
- Payment lifecycle is represented as:
  - `payment_intent` document (business intent)
  - system-generated `payment_resolution` document (settle/void/fail), linked to intent.

### 2. New Platform Packages
- `packages/platform/connectors` -> `@bedrock/connectors`
- `packages/platform/orchestration` -> `@bedrock/orchestration`

### 3. Legacy Runtime Removal (No Compatibility Layer)
- Remove old treasury payment-case style public behavior.
- Remove old treasury payment docTypes from public usage.
- Remove route compatibility adapters.
- Break `/v1` request/response shapes in place.

### 4. Cutover Strategy
- Hard reset environments at cutover (`db:nuke` + migrate + reseed).
- No table-to-table compatibility bridges.
- No dual-write period.
- No legacy endpoint shims.

## Phase-by-Phase Agentic Implementation

## Phase 0: Program Freeze and Cutover Guardrails
1. Freeze legacy payment-surface changes and declare this branch as the only payment-runtime workstream.
2. Create a cutover runbook with explicit downtime and reset steps.
3. Mark old payment contracts as deprecated internally and block new dependencies on old treasury flow.
4. Define branch and merge policy: only phases in order, no mixed legacy/new runtime code in final state.

Exit criteria:
- Runbook approved.
- Scope freeze communicated.
- No new code merged against legacy payment runtime contracts.

## Phase 1: Database Redesign (Hard Cutover Baseline)
1. Add new schema files and exports in:
   - [connectors schema](/Users/alexey.eramasov/dev/ledger/packages/platform/db/src/schema/connectors.ts)
   - [orchestration schema](/Users/alexey.eramasov/dev/ledger/packages/platform/db/src/schema/orchestration.ts)
   - [schema index](/Users/alexey.eramasov/dev/ledger/packages/platform/db/src/schema/index.ts)
2. Create connector tables:
   - `connector_payment_intents`
   - `payment_attempts`
   - `connector_events`
   - `connector_references`
   - `connector_health`
   - `connector_cursors`
3. Create orchestration tables:
   - `routing_rules`
   - `provider_corridors`
   - `provider_fee_schedules`
   - `provider_limits`
   - `orchestration_scope_overrides` (scope_type fixed to `book` in v1)
4. Enforce DB invariants:
   - Unique `(document_id)` in `connector_payment_intents`
   - Unique `(intent_id, attempt_no)` in `payment_attempts`
   - Unique `(provider_code, webhook_idempotency_key)` in `connector_events`
   - Unique `(provider_code, ref_kind, ref_value)` in `connector_references`
   - Claim indexes for dispatch/poll/ingest workers
5. Update seed layer to include baseline providers, corridors, fee schedules, limits, and default routing rules.
6. Regenerate migrations for hard-cutover baseline and keep one coherent migration path for fresh reset deployment.

Exit criteria:
- Schema compiles.
- Migration applies cleanly on empty DB.
- Seed produces routable provider/rule state.

## Phase 2: `@bedrock/connectors` Runtime Implementation
1. Scaffold package with Bedrock closure pattern:
   - `src/service.ts`
   - `src/internal/context.ts`
   - `src/validation.ts`
   - `src/errors.ts`
   - `src/commands/*`
   - `src/workers/*`
   - `src/index.ts`
2. Implement provider adapter contract:
   - `initiate(intent, attempt) -> provider submission result`
   - `getStatus(attemptRef) -> provider status`
   - `verifyAndParseWebhook(rawEvent) -> parsed event`
   - `fetchStatements(range, cursor) -> records + nextCursor`
3. Implement connectors service commands:
   - `createIntentFromDocument`
   - `enqueueAttempt`
   - `recordDispatchResult`
   - `recordStatusResult`
   - `handleWebhookEvent` (idempotent mutation)
   - `ingestStatementBatch`
   - `markIntentTerminal`
4. Implement canonical status model:
   - Intent: `planned | in_progress | succeeded | failed | cancelled`
   - Attempt: `queued | dispatching | submitted | pending | succeeded | failed_retryable | failed_terminal | cancelled`
5. Add idempotency scopes in [idempotency scopes](/Users/alexey.eramasov/dev/ledger/packages/platform/idempotency/src/scopes.ts) for all connector write actions.

Exit criteria:
- Unit tests for status transitions and idempotency replay/conflict pass.
- Package builds and exports are stable.

## Phase 3: `@bedrock/orchestration` Runtime Implementation
1. Scaffold package with same closure+commands pattern.
2. Implement routing engine:
   - Rule filtering by corridor, amount bands, currency, countries, risk band.
   - Candidate pruning by `provider_corridors` + `provider_limits`.
   - Cost scoring from `provider_fee_schedules` + FX markup.
   - SLA/health weighting from `connector_health`.
3. Implement deterministic score function and tie-breakers:
   - Primary sort by score descending.
   - Secondary sort by explicit rule priority.
   - Final deterministic tie-break by provider code lexicographic.
4. Implement retry/fallback planning:
   - Exponential backoff for retryable failures.
   - Fallback sequence and degradation graph (example: instant rail to standard rail).
5. Implement per-book override resolver from `orchestration_scope_overrides`.

Exit criteria:
- Same inputs always yield same route order.
- Retry/fallback behavior fully deterministic and tested.
- Overrides work for `scope_type=book`.

## Phase 4: Payment Domain Rebuild on Documents
1. Create new payment module package (or replace old treasury module contents) for document modules:
   - `payment_intent` docType
   - `payment_resolution` docType (system-created)
2. Remove legacy treasury payment docTypes from runtime registry.
3. Define `payment_intent` payload contract:
   - direction (`payin | payout`)
   - amount/currency
   - source/destination operational account references
   - corridor metadata
   - provider constraints (optional)
4. Define `payment_resolution` payload contract:
   - intentDocumentId
   - resolutionType (`settle | void | fail`)
   - provider references
   - reason/meta
5. On `payment_intent` post:
   - produce ledger pending entries through accounting/ledger runtime
   - create connector intent
   - call orchestration plan and queue first attempt
6. On terminal connector events:
   - generate `payment_resolution` document
   - post final ledger entries (settle or void/fail path)

Exit criteria:
- Payment lifecycle is fully executable via new docTypes.
- No runtime dependency on legacy treasury payment-case flow remains.

## Phase 5: API Cutover (`/v1` Breaking In Place)
1. Remove old payment-facing `/v1` contracts and replace with:
   - `/v1/payments`
   - `/v1/connectors`
   - `/v1/orchestration`
2. Keep documents runtime internal; do not expose old generic payment doc workflows as public contract.
3. Add `/v1/payments` endpoints:
   - create/list/get
   - submit/approve/reject/post/cancel
   - timeline/status/details (aggregated doc + orchestration + attempts + provider refs)
4. Add `/v1/connectors` endpoints:
   - provider config CRUD
   - attempt/events query
   - statement ingest controls (admin)
   - webhook receive endpoint for providers
5. Add `/v1/orchestration` endpoints:
   - routing rules CRUD
   - provider corridor CRUD
   - fee schedule CRUD
   - limits CRUD
   - per-book override CRUD
   - route simulation endpoint
6. Update permissions in [permissions](/Users/alexey.eramasov/dev/ledger/apps/api/src/auth/permissions.ts):
   - add `payments`, `connectors`, `orchestration` resources
   - remove payment permissions that only served legacy runtime
7. Rebuild API dist types after API changes:
   - `bun run build --filter=api`

Exit criteria:
- `/v1` only exposes new payment/connectors/orchestration contracts.
- API client types compile against the new routes only.

## Phase 6: Worker Topology Finalization
1. Add workers:
   - `connectors-attempt-dispatch`
   - `connectors-status-poller`
   - `connectors-statement-ingest`
   - `orchestration-retry-fallback`
2. Wire workers in:
   - [workers env](/Users/alexey.eramasov/dev/ledger/apps/workers/src/env.ts)
   - [workers registry](/Users/alexey.eramasov/dev/ledger/apps/workers/src/modules/registry.ts)
   - [worker app](/Users/alexey.eramasov/dev/ledger/apps/workers/src/all.ts)
   - [turbo env](/Users/alexey.eramasov/dev/ledger/turbo.json)
3. Add monitoring dimensions for new workers in health and Prometheus metrics.
4. Ensure recovery semantics:
   - lease-based claims
   - retry/backoff
   - poison/final failure path
   - idempotent reprocessing

Exit criteria:
- Worker fleet processes full payment lifecycle without manual intervention.
- Health endpoints show all new loops and degraded status correctly.

## Phase 7: SDK and Web Cutover
1. Update `@bedrock/api-client` generated contracts to new `/v1` endpoints.
2. Update web app pages to use `/v1/payments` instead of legacy payment docs surface.
3. Remove UI flows tied only to removed legacy payment docTypes.
4. Add operations views:
   - payment timeline with attempts
   - provider event history
   - route decision explanation
5. Keep non-payment modules unchanged unless their contracts changed.

Exit criteria:
- Web builds with no references to removed payment contracts.
- User can create and monitor end-to-end payin/payout through new APIs.

## Phase 8: Full Test Matrix and Quality Gates
1. Unit tests:
   - connectors command/state machine
   - orchestration routing/scoring/retries
   - webhook verification/idempotency
2. Integration tests:
   - payment intent post -> orchestration -> attempts -> resolution docs
   - fallback and partial degradation
   - statement ingest -> reconciliation ingestion bridge
3. API tests:
   - `/v1/payments`, `/v1/connectors`, `/v1/orchestration` happy and failure paths
4. Worker tests:
   - claim/lease/retry behavior
   - duplicate delivery safety
5. Load tests:
   - burst webhook ingestion
   - high-volume attempt dispatch
   - statement backfill windows
6. Security tests:
   - webhook signature replay/forgery rejection
   - permission boundaries on admin endpoints

Exit criteria:
- CI suite green for all new projects.
- Load and failure tests meet defined SLOs.

## Phase 9: Hard Cutover Execution and Cleanup
1. Execute hard reset in target environments:
   - DB nuke
   - migrate
   - seed
2. Deploy new API/workers/web together; no staged compatibility mode.
3. Remove dead code and packages tied to legacy payment runtime.
4. Update architecture docs:
   - [architecture](/Users/alexey.eramasov/dev/ledger/docs/architecture.md)
   - [implementation details](/Users/alexey.eramasov/dev/ledger/docs/implementation-details.md)
5. Run smoke suite and reconciliation sanity checks post-deploy.

Exit criteria:
- Only new runtime is active.
- No legacy payment endpoints/docTypes are reachable.
- Operational dashboards healthy.

## Important Public API / Interface / Type Changes

1. New public API groups on `/v1`:
   - `/v1/payments`
   - `/v1/connectors`
   - `/v1/orchestration`
2. Removed/replaced payment-facing legacy contracts on `/v1`.
3. New platform interfaces:
   - `ConnectorAdapter`
   - `ConnectorsService`
   - `OrchestrationService`
   - routing rule and score explanation DTOs
4. New document module contracts:
   - `payment_intent`
   - `payment_resolution`
5. New permission resources:
   - `payments`
   - `connectors`
   - `orchestration`

## Test Cases and Scenarios

1. Idempotency replay: same key and same payload returns same result for create, post, webhook, dispatch.
2. Idempotency conflict: same key with different payload yields conflict.
3. Route determinism: identical inputs produce identical candidate ordering.
4. Retry policy: retryable provider failures schedule exponential backoff correctly.
5. Fallback policy: exhausted or terminal failure triggers next provider/degraded rail.
6. Polling-only rail: pending attempts resolve through poller without webhooks.
7. Webhook dedupe: duplicate webhook event is no-op after first application.
8. Webhook signature failure: rejected event stored, no state mutation.
9. Statement cursor correctness: ingest resumes from last cursor without duplicates or gaps.
10. Payment lifecycle: intent post creates attempts and terminal provider event creates resolution doc.
11. Ledger consistency: settlement/void postings are balanced and idempotent.
12. Worker resilience: restart/replay does not duplicate side effects.
13. API authorization: admin-only connector/orchestration writes are enforced.
14. End-to-end UI flow: create payment, observe attempts, terminal resolution visible in timeline.

## Assumptions and Defaults

1. Hard cutover is accepted: existing payment runtime data is not migrated; environments are reset.
2. API version stays `/v1`; contracts break in place.
3. Documents remain workflow source-of-truth; connector/orchestration tables are execution-state projections linked to docs.
4. Scope overrides are `book` only in v1.
5. No compatibility routes, no dual writes, no feature-flagged fallback runtime.
6. Existing non-payment modules stay unless directly impacted by route/schema changes.
7. Reconciliation remains the exception/matching engine; connectors feed it instead of replacing it.

## Agent Execution Order (Strict)
1. Phase 0
2. Phase 1
3. Phase 2 and Phase 3 in parallel after Phase 1
4. Phase 4 after Phase 2 and 3
5. Phase 5 after Phase 4
6. Phase 6 after Phase 5
7. Phase 7 after Phase 5 and 6
8. Phase 8 after Phase 7
9. Phase 9 final

No phase skipping is allowed for implementation.
