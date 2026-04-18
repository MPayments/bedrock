# Archived: Hard-cutover phased implementation plan for Bedrock route composer

## Goal

Ship a fully usable, route-driven deal execution feature with:

- `Deal` as the only commercial root
- route composition in `apps/finance`
- expected economics in `@bedrock/calculations`
- actual execution facts in `@bedrock/treasury`
- reconciliation-driven confirmation and variance tracking
- CRM and Portal switched to the new deal model
- zero backward-compatibility code paths after cutover

This plan assumes the current repo topology already exists:

- apps: `api`, `crm`, `finance`, `portal`, `workers`, `db`
- modules: `agreements`, `calculations`, `deals`, `files`, `iam`, `parties`, `treasury`, `documents`, `accounting`, `ledger`, `reconciliation`

## Non-negotiable delivery rules

1. No dual-write.
2. No legacy read shells.
3. No feature flags that preserve the old application-based flow after cutover.
4. No UI-only calculations; all money logic lives in domain/application modules.
5. No merge until end-to-end flow works from deal creation to realized P&L and reconciliation.
6. Every phase that changes contracts must regenerate API output and SDK client types.
7. Every phase must leave the branch buildable and testable.
8. Final rollout is a destructive cutover with DB backup + one-shot migration + legacy table drop.

## Final target business flow

1. Operator creates a `Deal`.
2. Operator chooses or composes a route.
3. System prices the route and creates a calculation snapshot.
4. Accepted calculation freezes the commercial promise.
5. Workflow materializes treasury operations and instructions from the route.
6. Treasury records actual fills, fees, and cash movements.
7. Reconciliation matches external records to execution facts.
8. System computes expected vs actual variance and realized net margin.
9. Documents/accounting/ledger reflect formal posting outcomes.
10. Deal closes only when operational, accounting, and reconciliation rules are satisfied.

## Canonical model

### `@bedrock/parties`

Keep these meanings strict:

- `customers` = commercial account root / agreement owner / deal owner
- `organizations` = internal holding legal entities only
- `counterparties` = all non-holding legal entities and persons, including:
  - customer legal entities
  - suppliers
  - exporters
  - beneficiaries
  - external sub-agents
- customer-owned legal entities are `counterparties.customer_id = customers.id`
- external sub-agents are `counterparty + sub_agent_profile`

### `@bedrock/deals`

#### Tables

- `deals`
- `deal_status_history`
- `deal_approvals`
- `deal_routes`
- `deal_route_versions`
- `deal_route_participants`
- `deal_route_legs`
- `deal_route_cost_components`
- `route_templates`
- `route_template_participants`
- `route_template_legs`
- `route_template_cost_components`

#### Key enums

- `deal_type`
  - `payment`
  - `currency_exchange`
  - `currency_transit`
  - `exporter_settlement`
  - `internal_treasury`
- `deal_status`
  - `draft`
  - `pricing`
  - `quoted`
  - `awaiting_customer_approval`
  - `awaiting_internal_approval`
  - `approved_for_execution`
  - `executing`
  - `partially_executed`
  - `executed`
  - `reconciling`
  - `closed`
  - `cancelled`
  - `rejected`
  - `expired`
  - `failed`
- `route_leg_kind`
  - `collection`
  - `intracompany_transfer`
  - `intercompany_funding`
  - `fx_conversion`
  - `payout`
  - `return`
  - `adjustment`
- `route_component_classification`
  - `revenue`
  - `expense`
  - `pass_through`
  - `adjustment`
- `route_component_formula_type`
  - `fixed`
  - `bps`
  - `per_million`
  - `manual`
- `route_component_basis_type`
  - `deal_source_amount`
  - `deal_target_amount`
  - `leg_from_amount`
  - `leg_to_amount`
  - `gross_revenue`

#### Required fields

`deals`
- `id`
- `number`
- `type`
- `status`
- `customer_id`
- `acting_counterparty_id`
- `beneficiary_counterparty_id` nullable
- `source_currency_id`
- `source_amount_minor`
- `target_currency_id` nullable
- `target_amount_minor` nullable
- `agreement_id` nullable
- `agreement_version_id` nullable
- `current_route_version_id`
- `accepted_calculation_id` nullable
- `user_status`
- `created_by`
- timestamps

`deal_route_participants`
- `id`
- `route_version_id`
- `code`
- `role`
- `party_kind` (`customer` | `counterparty` | `organization`)
- `party_id`
- `requisite_id` nullable
- `display_name_snapshot`
- `sequence`
- `metadata_json`

`deal_route_legs`
- `id`
- `route_version_id`
- `code`
- `idx`
- `kind`
- `from_participant_id`
- `to_participant_id`
- `from_currency_id`
- `to_currency_id`
- `expected_from_amount_minor`
- `expected_to_amount_minor`
- `expected_rate_num`
- `expected_rate_den`
- `settlement_model`
- `execution_counterparty_id` nullable
- `notes`

`deal_route_cost_components`
- `id`
- `route_version_id`
- `leg_id` nullable
- `code`
- `family`
- `classification`
- `formula_type`
- `basis_type`
- `currency_id`
- `fixed_amount_minor` nullable
- `bps` nullable
- `per_million` nullable
- `manual_amount_minor` nullable
- `rounding_mode`
- `included_in_client_rate`
- `sequence`
- `notes`

### `@bedrock/agreements`

Add route-aware defaults:

- `agreement_versions`
- `agreement_fee_rules`
- `agreement_route_policies`
- `agreement_route_template_links`

Each agreement version may define:

- allowed deal types
- allowed corridors
- default route template
- markup rules
- sub-agent commission rules
- wire fee defaults
- liquidity buffer rules
- approval thresholds
- quote TTL

### `@bedrock/calculations`

#### Tables

- `calculations`
- `calculation_snapshots`
- `calculation_lines`

#### Required refactor

Each calculation line must be rich enough to preserve route economics, not just totals.

Add fields:

- `snapshot_id`
- `deal_id`
- `route_version_id`
- `route_leg_id` nullable
- `route_component_id` nullable
- `component_code`
- `component_family`
- `classification`
- `kind`
- `formula_type`
- `basis_type`
- `currency_id`
- `amount_minor`
- `basis_amount_minor` nullable
- `input_bps` nullable
- `input_fixed_minor` nullable
- `source_kind` (`manual` | `agreement` | `quote` | `provider` | `system`)

Keep immutable snapshots of:

- deal header
- route version
- agreement version
- provider quote provenance
- totals and effective rates

### `@bedrock/treasury`

#### New actual-fact tables

- `treasury_execution_fills`
- `treasury_execution_fees`
- `treasury_cash_movements`

#### Required link fields

Add to treasury records where appropriate:

- `deal_id`
- `route_version_id`
- `route_leg_id`
- `calculation_snapshot_id` nullable

#### Actual fact fields

`treasury_execution_fills`
- provider/exchange ref
- executed at
- sold currency/amount
- bought currency/amount
- actual rate
- provider counterparty
- linked operation/instruction/event

`treasury_execution_fees`
- provider/bank ref
- charged at
- fee family
- fee currency/amount
- linked operation/instruction/fill/leg

`treasury_cash_movements`
- external record ref
- booked at / value date
- debit/credit side
- currency/amount
- account/requisite/provider refs
- linked operation/instruction/leg

### `@bedrock/reconciliation`

Keep reconciliation as match/exception ownership only.

Add normalized linkage to:

- execution fills
- execution fees
- cash movements
- deals
- route legs

Do not store actual economics only as raw external JSON.

### Projections / read models

Create explicit read models:

- `deal_list_view`
- `deal_summary_view`
- `deal_route_view`
- `deal_calculation_summary_view`
- `deal_timeline_view`
- `deal_execution_view`
- `deal_profitability_view`
- `deal_exception_view`
- `route_template_list_view`

## Commands and workflows

### Required write commands

- `CreateDeal`
- `UpdateDealHeader`
- `CreateRouteDraft`
- `ReplaceRouteVersion`
- `ApplyRouteTemplate`
- `CreateCalculationFromRoute`
- `AcceptCalculation`
- `SupersedeCalculation`
- `ApproveDeal`
- `RequestExecution`
- `RecordExecutionFill`
- `RecordExecutionFee`
- `RecordCashMovement`
- `ResolveExecutionVariance`
- `CloseDeal`
- `CancelDeal`

### Required workflows

- `workflow-deal-pricing`
- `workflow-deal-approval`
- `workflow-deal-execution`
- `workflow-deal-closing`
- `workflow-route-template-application`
- `workflow-execution-fact-normalization`
- `workflow-expected-vs-actual-variance`

## Phased plan

---

## Phase 0 — hard-cutover contract and deletion map

### Scope

- Supersede any old phased plan that keeps legacy ops tables or compatibility shells.
- Write one architecture note that freezes the target model above.
- Enumerate every legacy route/service/page/table to delete.
- Freeze all new feature work on the old application-based flow.

### Required outputs

- `docs/adr/xxxx-route-driven-deal-execution.md`
- `docs/cutover/route-composer-delete-map.md`
- `docs/cutover/route-composer-acceptance-scenarios.md`

### Done when

- There is a single approved target model.
- Every old flow has an explicit delete target.
- Team agrees that cutover is destructive, not compatibility-preserving.

---

## Phase 1 — normalize parties and access semantics

### Scope

- Enforce strict meanings for `customers`, `organizations`, `counterparties`, and `sub_agent_profile`.
- Ensure finance operator lookups can search across all participant kinds.
- Keep `organizations` internal-only.
- Keep customer legal entities and beneficiaries inside `counterparties`.
- Keep access control in IAM; do not let party tables carry auth semantics.

### Coding tasks

- Refactor `@bedrock/parties` DTOs and services so participant lookup is explicit and typed.
- Add unified lookup endpoint for route composer typeahead:
  - query by first letters
  - filter by participant kind
  - return legal name, role hints, requisites summary, active flags
- Add `sub_agent_profiles` if not present or make it canonical.
- Remove any deal-time dependency on legacy party aliases or ambiguous owner columns.

### API surface

- `GET /v1/participants/lookup`
- `GET /v1/customers/:id/legal-entities`
- `GET /v1/route-composer/lookup-context`

### Done when

- Route composer can search and select customers, organizations, counterparties, and sub-agents by name prefix.
- Customer legal entities are always selected via `counterparties`.
- There is no remaining ambiguity about internal entity vs external counterparty.

---

## Phase 2 — make `Deal` the only commercial root

### Scope

- Delete separate application-first flow.
- Keep drafts inside `Deal` lifecycle.
- Re-home intake fields from any application-like model into `deals`.
- Ensure CRM and finance both open the same `Deal` record.

### Coding tasks

- Refactor `@bedrock/deals` service layer to own creation, status changes, approvals, and links.
- Delete application-level endpoints and UI routes.
- Add final deal statuses and state-machine guards.
- Implement legal transitions only; no free-form status mutation.

### Done when

- New business work starts by creating a `Deal`, not an application.
- Old application endpoints and pages are deleted.
- A deal can exist without route/calc, then move into pricing.

---

## Phase 3 — implement canonical route model in `@bedrock/deals`

### Scope

- Add route drafts and immutable route versions.
- Model participants, legs, and cost components explicitly.
- Make route versions the source of truth for estimate provenance.

### Coding tasks

- Create new Drizzle schema and repositories for route tables.
- Add services:
  - `createRouteDraftForDeal`
  - `replaceRouteVersion`
  - `validateRouteVersion`
  - `summarizeRouteVersion`
- Validation rules:
  - participant graph must be connected
  - leg sequence must be contiguous
  - currencies must match leg semantics
  - each required role must be bound
  - each cost component must have valid formula inputs
  - route types must satisfy deal type invariants
- Add immutable versioning on every meaningful route save.

### Done when

- A deal may have multiple route versions.
- Each version fully describes participants, legs, and economics inputs.
- Validation rejects broken route graphs.

---

## Phase 4 — add route templates and agreement-driven defaults

### Scope

- Do not build a graph optimizer.
- Build deterministic templates and presets.
- Use agreements to prefill cost and approval defaults.

### Coding tasks

- Add route template tables and services.
- Add template lifecycle:
  - draft
  - published
  - archived
- Add `ApplyRouteTemplate` command that materializes a fresh route version.
- Add agreement-version rules for:
  - default markup
  - default wire fee
  - default sub-agent commission
  - allowed template set
  - quote validity
- Seed at least these templates:
  - RUB collection -> AED internal transfer -> AED/USD conversion -> USD payout
  - direct payment
  - currency transit
  - exporter settlement

### Done when

- Operator can create a deal from a route template.
- Agreement version fills in defaults automatically.
- Templates are versioned and reusable.

---

## Phase 5 — refactor calculations into a route-based estimate engine

### Scope

- Calculations must preserve the full route economics breakdown.
- Snapshots must freeze exactly what was promised commercially.
- Optional provider quote provenance stays, but route version is primary provenance.

### Coding tasks

- Extend `@bedrock/calculations` lines and snapshots as defined above.
- Implement calculation engine that:
  - consumes deal header + route version + agreement version + provider quote data
  - computes gross client revenue
  - computes all expense lines by family
  - computes pass-through lines
  - computes net margin and effective rate
  - stores exact line-level inputs and outputs
- Add calculation state machine:
  - `draft`
  - `offered`
  - `accepted`
  - `expired`
  - `cancelled`
  - `superseded`
- Add compare API between current and previous snapshots.

### Done when

- Finance operator can generate a calculation snapshot from a route version.
- Snapshot shows all component lines and final net margin.
- Accepted calculation freezes route + agreement + pricing provenance.

---

## Phase 6 — materialize treasury execution from accepted route

### Scope

- Accepted calculation drives execution planning.
- Each route leg maps to treasury operations/instructions.
- Actual execution facts are first-class records, not just reconciliation side effects.

### Coding tasks

- Add operation planning workflow from route version to treasury operations.
- Add new actual-fact tables and repositories.
- Link operations/instructions/events back to deal and route leg.
- Implement write commands for manual/internal fact entry where external ingestion is absent.
- Ensure existing treasury operation kinds are reused where possible.

### Mapping rules

- `collection` leg -> treasury `collection`
- `fx_conversion` leg -> treasury `fx_conversion`
- internal movement legs -> `intracompany_transfer` or `intercompany_funding`
- `payout` leg -> treasury `payout`
- `return` leg -> treasury `return`

### Done when

- Accepted deals generate executable treasury plans.
- Operators can record actual fills, fees, and cash movements against route legs.
- Each actual fact is queryable by deal and leg.

---

## Phase 7 — reconciliation, accounting, and deal-closing logic

### Scope

- Reconciliation confirms or disputes external truth.
- Accounting and ledger stay formal execution layers.
- Deal close rules must be explicit and enforceable.

### Coding tasks

- Add normalization workflow from external records to execution facts where appropriate.
- Add variance projection:
  - expected vs actual by leg
  - expected vs actual by cost family
  - total realized net margin
- Update document/accounting integration so actual economics flow into posting sources and reporting where required.
- Implement deal close rules:
  - all mandatory treasury operations terminal
  - no blocking reconciliation exceptions
  - mandatory documents posted or not required
  - realized profitability available

### Done when

- Completed deal shows realized P&L and variance to estimate.
- Blocking exceptions stop closing.
- Deal close is a legal command, not a manual status edit.

---

## Phase 8 — finance app route composer UI

### Scope

Route composer lives in `apps/finance`, not CRM.

### New finance routes

- `/deals`
- `/deals/new`
- `/deals/[dealId]`
- `/deals/[dealId]/compose`
- `/deals/[dealId]/calculation`
- `/deals/[dealId]/execution`
- `/deals/[dealId]/reconciliation`
- `/route-templates`
- `/route-templates/[templateId]`

### UI principles

- No free-form graph editor in v1.
- Use a sequenced, table-first composer with optional read-only route diagram.
- All writes go through explicit commands.
- All read screens use projections.

### Core screens

#### 1. Deal wizard
- choose deal type
- choose customer
- choose acting customer legal entity
- choose beneficiary/exporter if needed
- enter amount/currencies
- choose agreement/version
- optionally start from template

#### 2. Route composer
- participant strip with typeahead lookup
- ordered legs table
- cost component editor
- summary sidebar with:
  - gross revenue
  - total costs
  - pass-through
  - net margin
  - margin bps
  - effective client rate
- validation banner

#### 3. Calculation workspace
- current calculation snapshot
- compare with previous snapshots
- accept / replace / expire actions

#### 4. Execution workspace
- generated treasury operations
- instructions and statuses
- actual fills / fees / cash movements
- expected vs actual cards

#### 5. Reconciliation workspace
- matched records
- open exceptions
- variance explanations
- close blockers

#### 6. Route template workspace
- list
- create/edit/publish/archive
- preview economics defaults

### Component checklist

- `ParticipantLookupCombobox`
- `RouteParticipantsTable`
- `RouteLegsEditor`
- `RouteCostComponentsEditor`
- `RouteSummarySidebar`
- `CalculationSnapshotCompareDrawer`
- `ExecutionActualsTable`
- `VarianceSummaryCard`
- `DealTimeline`
- `CloseBlockersPanel`

### Done when

- Finance operator can create, price, approve, execute, reconcile, and close a deal entirely from finance UI.
- Route templates are manageable in finance UI.
- No business calculation logic lives in React components.

---

## Phase 9 — CRM and Portal refactor to the new deal model

### Scope

- CRM stops thinking in applications and detached calculations.
- Portal reads the same deal root.
- Route editing remains finance-only.

### CRM changes

- Deal list becomes primary commercial workspace.
- Deal page shows:
  - summary
  - accepted calculation
  - files
  - approvals
  - timeline
  - exceptions
  - final profitability summary
- Remove separate application pages.
- Remove detached calculation pages.

### Portal changes

- Show deal status, accepted calculation summary, files, and timeline.
- Do not expose internal route mechanics or treasury artifacts.

### Done when

- CRM and Portal consume the new deal/read model stack.
- There are no UI routes depending on removed application-first concepts.
- Finance remains the only place for route editing and execution detail entry.

---

## Phase 10 — destructive migration and API/SDK cutover

### Scope

- Migrate live data once.
- Drop legacy structures in the same cutover.
- Regenerate all contracts and clients.

### Coding tasks

- Write one-shot ETL scripts from legacy commercial tables into:
  - `customers`
  - `counterparties`
  - `agreements`
  - `deals`
  - `deal_routes*`
  - `calculations`
  - `files`
- Export backup snapshot before cutover.
- Apply final schema migration.
- Run ETL.
- Run invariants/consistency checks.
- Drop legacy tables and routes in the same release branch.
- Regenerate OpenAPI + SDK client.
- Update seeds to final model only.

### Delete list categories

- old application routes/pages
- old calculation routes/pages detached from deals
- any legacy ops tables still carrying commercial truth
- compatibility DTOs/adapters
- old nav items that point to removed workflows

### Done when

- Fresh environment boots only on final model.
- Live migrated environment serves only final APIs and UIs.
- No active runtime path reads or writes legacy schema.

---

## Phase 11 — hardening, tests, and release gate

### Scope

- Prove the feature is production-usable.
- Seed realistic data.
- Lock the acceptance suite.

### Required tests

#### Module tests
- route validation
- calculation formula engine
- template application
- execution-fact recording
- close blockers

#### Integration tests
- deal -> calculation -> accept -> execution plan
- execution facts + reconciliation -> realized P&L
- accounting/document links continue to work

#### UI tests
- finance route composer flow
- template creation flow
- expected vs actual variance flow
- CRM deal summary flow
- portal deal visibility flow

#### Staging acceptance scenarios
1. supplier payment with internal transfer + FX + payout
2. currency transit
3. currency exchange
4. exporter settlement
5. sub-agent commission case
6. fixed wire fee + percentage fee mix
7. reconciliation exception blocks close
8. actual realized margin matches expected when facts align

### Release gate

Do not release until all of the following are true:

- finance app can run the full route flow end-to-end
- CRM and Portal read the new deal model only
- realized P&L is visible and reconcilable
- no legacy pages/routes/tables remain active
- all tests and acceptance scenarios pass

## Codex execution rules

Use these rules for the coding agent:

1. Work phase-by-phase in order.
2. Do not invent compatibility layers.
3. Do not leave TODO placeholders in domain logic.
4. Regenerate contracts and client types immediately after API changes.
5. Add tests in the same phase as the behavior.
6. Keep React dumb; push business rules into module services.
7. Prefer explicit commands and projections over generic CRUD mutation screens.
8. When a phase deletes an old flow, actually remove the code instead of deprecating it.
9. Use repo package exports only; no deep imports.
10. Keep schema ownership inside the owning bounded context.

## Final acceptance statement

This feature is considered done only when a finance operator can:

- create a deal
- choose participants
- compose a multi-leg route
- enter mixed percent/fixed/manual cost lines
- see expected net margin
- freeze an accepted calculation
- generate treasury execution
- capture actual fills, fees, and cash movements
- reconcile the deal
- see realized net margin and variance
- close the deal

with no dependency on the old application-based flow and no legacy compatibility code left in production.
