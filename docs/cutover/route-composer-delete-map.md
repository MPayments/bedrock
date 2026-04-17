# Route Composer Delete Map

This map enumerates runtime areas that must be removed as the route-driven cutover lands. The goal is explicit deletion, not deprecation.

## Commercial flow to remove

- application-first commercial runtime once deal-first creation is canonical
- detached calculation flows that do not belong to a deal root
- quote acceptance paths that act as the only execution recipe source

## API routes to remove or rewrite

- legacy application routes and detached application pages once deal-first flow replaces them
- detached calculation routes that are not rooted under a deal lifecycle
- compatibility customer legal-entity shells that model legal entities as anything other than counterparties
- commercial endpoints whose write path depends on the old application-based execution model

## UI surfaces to remove or rewrite

- CRM pages that start work from the old application-first workflow
- CRM pages that treat calculations as detached records instead of accepted deal state
- finance pages that edit treasury execution without a route-backed deal context
- nav items that point at removed commercial workflows

## Domain/runtime structures to remove after replacement

- any execution recipe logic derived only from legacy deal/application type branching when route snapshots become canonical
- compatibility adapters translating removed commercial models into deal/route snapshots
- legacy DTOs kept only for old CRM/application screens
- old pricing shells that mirror route economics outside `@bedrock/calculations`

## Database/runtime truth to remove after migration

- any legacy commercial tables still carrying commercial truth outside final `deals`, `deal_routes*`, and `calculations`
- any legacy ops tables still acting as the only source of expected commercial truth
- migration seeds/bootstrap logic that create data for removed workflows

## Hard delete checkpoints by phase

### Phase 1

- remove ambiguous route-composer assumptions about party aliases
- stop introducing new lookups that bypass strict customer/organization/counterparty/sub-agent semantics

### Phase 2

- delete separate application-first creation flow
- delete endpoints and UI entrypoints that create business work outside `Deal`

### Phase 3

- delete any route representation that is not an immutable deal route version

### Phase 5

- delete calculation logic that cannot preserve route component provenance
- stop using totals-only commercial summaries as the source of truth for profitability

### Phase 6

- delete execution planning paths that are derived only from legacy commercial branching once route-driven planning is live

### Phase 9

- delete CRM and Portal pages that still depend on removed application-first or detached-calculation concepts

### Phase 10

- drop migrated legacy tables in the same release branch as the ETL cutover
- remove compatibility routes, DTOs, seeds, and navigation for deleted workflows

## Non-negotiable rule

No legacy flow stays active behind a feature flag after cutover. The delete work is part of delivery, not follow-up cleanup.
