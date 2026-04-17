# ADR 0003: Route-Driven Deal Execution Cutover

## Status

Accepted

## Context

Bedrock currently mixes commercial intent, pricing snapshots, and treasury execution planning across:

- `@bedrock/deals` as the commercial root
- treasury quotes as both route estimate and partial execution plan
- calculations as partially route-aware snapshots
- treasury instructions and reconciliation as the only source of some operational facts

This makes multi-leg routing, expected-vs-actual profitability, and route-level execution provenance hard to reason about. Finance needs an explicit route composer that can:

1. bind participants across customers, counterparties, organizations, and sub-agents
2. price a multi-leg execution route with mixed fixed and percentage components
3. freeze an accepted commercial promise
4. materialize treasury execution from that accepted route
5. record actual fills, fees, and cash movements
6. reconcile realized facts back to the route and show variance

The cutover is destructive. We are not preserving the legacy application-first path in production after rollout.

## Decision

We standardize on the following target model.

### Commercial root

`Deal` remains the only commercial root.

- new commercial work starts from `Deal`
- route drafts, route versions, accepted calculations, approvals, and execution lifecycle all hang off the deal
- there is no separate application-first runtime flow after cutover

### Party semantics

Party meaning is strict:

- `customers` = commercial account root / deal owner / agreement owner
- `organizations` = internal holding entities only
- `counterparties` = all external legal entities and persons
- customer-owned legal entities are stored as `counterparties.customer_id = customers.id`
- sub-agents are modeled as `counterparty + sub_agent_profile`
- IAM owns access control semantics; party tables do not

### Route model

Canonical route data lives in `@bedrock/deals`.

Each route version explicitly stores:

- participants
- legs
- cost components
- immutable version provenance

Route versions are the primary source of estimate provenance. A deal may have multiple route versions over time.

### Calculation model

`@bedrock/calculations` becomes the expected economics engine.

Calculation snapshots must preserve:

- deal header snapshot
- route version snapshot/reference
- agreement version provenance
- provider quote provenance when applicable
- line-level route economics with classification, basis, formula inputs, and source kind

Accepted calculations freeze the commercial promise.

### Treasury model

`@bedrock/treasury` owns actual execution facts.

Execution planning is materialized from the accepted route/calculation into treasury operations and instructions. Actual facts are stored as first-class records:

- execution fills
- execution fees
- cash movements

These records link back to the deal, route version, route leg, and accepted calculation where applicable.

### Reconciliation model

`@bedrock/reconciliation` remains the owner of matching, exceptions, and confirmation state.

Reconciliation does not act as the only storage location for actual economics. It links normalized external records to execution fills, fees, and cash movements, then confirms or disputes operational truth.

### UI ownership

- route composition lives in `apps/finance`
- CRM and Portal consume the same deal root and accepted calculation read models
- CRM and Portal do not edit route mechanics

### Cutover rule

We do not keep:

- dual-write
- legacy compatibility DTOs
- read shells that mirror removed application-first behavior
- feature flags that preserve the old flow after rollout

Fresh environments and migrated environments must both boot on the final model only.

## Consequences

### Positive

- route economics become explicit and auditable
- expected and actual profitability can be compared by leg and by cost family
- finance gets a deterministic route composer without spreadsheet side channels
- CRM, Portal, treasury, and reconciliation read the same commercial root

### Negative

- this is a large destructive cutover touching deals, treasury, calculations, and multiple UIs
- legacy pages, endpoints, and tables must be removed rather than wrapped
- live migration requires one-shot ETL and coordinated release discipline

### Immediate implementation rules

1. Implement phases in order.
2. Keep every phase buildable and testable.
3. Regenerate API/SDK outputs after contract changes.
4. Delete legacy flows when their replacement becomes canonical.
5. Keep business money logic out of React and in module/application code.
