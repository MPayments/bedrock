Archived planning note. The active source of truth is `refactring-plan.md`.

Here is the Codex plan I’d run **on top of the current `mpayments-integration` branch**, not as a fresh rewrite.

The branch already has the core deal foundation: `deals`, `deal_intake_snapshots`, `deal_legs`, `deal_participants`, `deal_timeline_events`, `deal_quote_acceptances`, `deal_capability_states`, and `deal_operational_positions`; the code also already defines the four external deal types `payment`, `currency_exchange`, `currency_transit`, and `exporter_settlement`. The API already exposes finance queue/workspace projections (`/v1/deals/finance/queues`, `/{id}/workflow`, `/{id}/finance-workspace`), and the Finance app already has `/treasury/deals` plus a workbench with Overview / Pricing / Documents / Execution tabs. ([GitHub][1])

So the next track should **not** be “rebuild deals again.” The real gap is that Finance is still too **quote-centered**: the current finance queue model is only `funding / execution / failed_instruction`, finance workspace actions are only `canCreateQuote / canCreateCalculation / canUploadAttachment`, related resources only include attachments / formal documents / quotes, and the UI still says quote creation is available only for “payments and conversions.” There is also no separate `/treasury/operations` surface in the Finance treasury nav right now. ([GitHub][2])

The operating model I would freeze is simple:

**Deal** = commercial root and finance context.
**Deal leg** = execution plan step.
**Treasury operation** = actual finance work item.
**Instruction/event** = provider/bank execution reality.
**Document + reconciliation** = control, accounting, and close reality.

That matches both Bedrock’s architecture and your own product direction: apps and workflows should compose use cases, not own business logic, and the frontend should stay small while treasury / FX / documents / ledger / reconciliation remain behind the backend. ([GitHub][3])  

I would also normalize your treasury naming now, before coding:

* **Incoming money** → `payin`
* **Outgoing money** → `payout`
* **Intra-company transfer** → `intracompany_transfer`
* **Between internal legal entities** → `intercompany_funding`
* **FX** stays a **leg inside execution**, not the whole finance workflow

For Multihansa’s deal types, Finance recipes should be:
`payment = payin → optional fx_conversion → payout`,
`currency_exchange = payin → fx_conversion → payout/return`,
`currency_transit = payin → intracompany_transfer or intercompany_funding → payout`,
`exporter_settlement = payout → optional intercompany_funding → later payin / receivable close`.  

## Pass 1 — finish the finance deal workspace

The fastest high-value pass is to **finish what the branch already returns**. The finance workspace projection already includes `executionPlan`, `operationalState`, `queueContext`, `relatedResources`, `nextAction`, `profitabilitySnapshot`, and even a `timeline`, while the current UI currently centers the screen around Overview / Pricing / Documents / Execution. That means the first pass should be read-model/UI only: no new execution writes yet. ([GitHub][4])

What Codex should do in this pass:

* Render the existing `timeline` in the finance deal workbench.
* Add an **execution summary rail** that groups each leg by kind, state, blocker, and primary operational position.
* Promote `queueReason`, blockers, and `nextAction` to the top of the screen.
* Keep Pricing visible, but demote it from “main finance job” to “one section of the deal.”
* Add finance filters on the deal journal by type, queue, applicant, internal entity, and blocker state using the existing queue/list projections.

Main touchpoints:

* `apps/finance/features/treasury/deals/components/workbench.tsx`
* `apps/finance/features/treasury/deals/lib/queries.ts`
* `apps/finance/features/treasury/deals/labels.ts`
* possibly small additions in `apps/api/src/routes/deals.ts` if any projection field is missing

Done when:

* a finance user can open a deal and answer “what is the next operational step?” without going into quotes first
* the timeline is visible
* the Execution tab feels primary, not decorative

## Pass 2 — compile deal legs into treasury execution refs

This is the first real backend pass. The current schema already gives you the right anchors: `deal_legs`, `deal_quote_acceptances`, `deal_calculation_links`, `deal_capability_states`, `deal_operational_positions`, and `deal_timeline_events`. What is missing is a deterministic **execution compiler** that turns a finance-ready deal into concrete treasury operation intents and keeps stable references from legs to operations. ([GitHub][1])

What Codex should do in this pass:

* Add a new workflow package, preferably `packages/workflows/workflow-deal-execution`.
* Inside it, add a service like `compileDealExecutionRecipe(...)` that takes:

  * deal type
  * intake snapshot
  * participant bindings
  * accepted quote
  * agreement / internal entity context
* Add a deals-owned linking table such as `deal_leg_operation_links`:

  * `id`
  * `deal_leg_id`
  * `treasury_operation_id`
  * `operation_kind`
  * `created_at`
  * optional `source_ref`
* Make materialization idempotent.
* Trigger it from a fixed command such as `RequestExecution`, not from page logic.

Recipe rules to encode:

* `payment`: `payin` → maybe `convert` → `payout`
* `currency_exchange`: `payin` → `convert` → `payout` or `return`
* `currency_transit`: `payin` → `transit_hold` + `intracompany_transfer` or `intercompany_funding` → `payout`
* `exporter_settlement`: `payout` / funding first, then expected collection close

Important constraint: **do not add `internal_treasury` here yet**. Your current code does not define it in `DEAL_TYPE_VALUES`, even though it exists in the broader v5 target plan. Keep internal treasury as pure treasury work until the external four types are solid. ([GitHub][5]) 

Done when:

* every finance-ready deal leg can resolve to a concrete treasury operation id
* execution planning no longer lives as labels and heuristics only
* quote acceptance remains anchored on the existing `deal_quote_acceptances` model, not a new duplicated state store

## Pass 3 — add a real `/treasury/operations` workspace

This is the pass that changes Finance from “deal browser with pricing tools” into an execution cockpit. The current Finance treasury nav includes `accounts`, `balances`, `counterparties`, `customers`, `deals`, `organizations`, `quotes`, and `rates`, but not a separate `operations` surface. That is the main UX gap now. ([GitHub][6])

What Codex should do in this pass:

* Add `apps/finance/app/(shell)/treasury/operations/page.tsx`
* Add `apps/finance/features/treasury/operations/*`
* Provide saved views:

  * Incoming money
  * Outgoing money
  * Intra-company transfers
  * Intercompany funding
  * FX conversions
  * Failed / returned / blocked
* Each operation row should show:

  * operation kind
  * amount / currency
  * internal entity
  * source / destination account
  * provider / route
  * instruction status
  * `dealRef` with deal id, type, applicant, status
  * next action
* Opening a row should show an operation panel plus a link back to the deal workbench.

API side:

* if the current `/v1/treasury` contracts already expose enough operation data, reuse them
* if not, add a finance projection route under the treasury route group instead of querying core tables from the UI

Done when:

* Finance users can work out of operation queues day to day
* `/treasury/deals` becomes the **context journal**
* `/treasury/operations` becomes the **actual work surface**

## Pass 4 — add finance execution commands

Right now the finance workspace action model only covers quote creation, calculation creation, and attachment upload. That is not enough for execution. This pass should add fixed backend commands for the real finance lifecycle, and the UI should consume backend-provided action availability rather than inferring it locally. ([GitHub][4]) 

What Codex should do in this pass:

* Extend finance workspace actions with execution commands, for example:

  * `canRequestExecution`
  * `canCreateLegOperation`
  * `canPrepareInstruction`
  * `canSubmitInstruction`
  * `canRetryInstruction`
  * `canVoidInstruction`
  * `canRequestReturn`
  * `canResolveExecutionBlocker`
  * `canCloseDeal`
* Add backend commands/endpoints for those actions.
* Keep writes idempotent.
* Append timeline events for every state-changing command.
* Mirror treasury instruction/event outcomes back into `deal_timeline_events` through workflow/outbox handling, not React-side orchestration.

The current `deal_timeline_events` table is already designed well for this because it has typed event kinds, visibility, payload, and a unique `(deal_id, source_ref)` constraint, which is exactly what you want for replay-safe system events. ([GitHub][1])

Main touchpoints:

* `packages/workflows/workflow-deal-execution/*`
* `packages/modules/deals/src/application/*`
* `packages/modules/treasury/*`
* `apps/api/src/routes/deals.ts`
* finance workbench and operations workspace action components

Done when:

* finance can move a deal from “ready” to “submitted/settled/failed/returned” through commands
* no one needs free-form manual finance status editing
* quotes become just the pricing prerequisite, not the finance center of gravity

## Pass 5 — reconciliation, close readiness, and per-type hardening

Bedrock is async in critical places and reconciliation is already a real subsystem, so “deal executed” must not mean “deal closed.” This pass makes close criteria operationally correct. 

What Codex should do in this pass:

* Extend `FinanceDealWorkspaceProjection` with:

  * `reconciliationSummary`
  * `relatedResources.reconciliationExceptions`
  * `closeReadiness`
  * `instructionSummary`
* Keep the top-level finance queues simple for now (`funding`, `execution`, `failed_instruction`), but add secondary stage filters:

  * awaiting collection
  * awaiting fx
  * awaiting intracompany transfer
  * awaiting intercompany funding
  * awaiting payout
  * awaiting reconciliation
  * ready to close
* Add type-specific close criteria:

  * `payment`: payout settled + docs okay + no blocking recon exception
  * `currency_exchange`: conversion completed + payout or return settled + no blocking recon exception
  * `currency_transit`: inbound and outbound complete + no blocked in-transit position
  * `exporter_settlement`: payout complete + receivable leg resolved + no blocking recon exception
* Add finance outcome card:

  * fee revenue
  * spread revenue
  * provider costs
  * reconciliation result
  * close button

Use the existing `profitabilitySnapshot`, `queueContext`, `executionPlan`, and `operationalState` as the base rather than inventing another finance-only deal model. ([GitHub][4])

Done when:

* Finance closes deals from actual treasury + reconciliation truth
* “done” is no longer just “we created a quote” or “we submitted a payout”
* exporter settlement and transit stop feeling like second-class edge cases

## What I would explicitly defer

I would **defer `internal_treasury` as a deal type** until after the four external deal types are solid in Finance. The current codebase’s deal enum does not include it yet, and many internal treasury actions do not need a client deal root anyway. Use the treasury workspace directly for pure liquidity management, sweeps, and internal funding until you have a clear reason to model those as deals. ([GitHub][5]) 

## What Codex should not do

Do not rebuild the deal schema from scratch.
Do not put leg-to-operation compilation in React components.
Do not make finance manage deals by free-form status edits.
Do not make quotes the main finance object.
Do not force `internal_treasury` into the current external deal flow.

Those guardrails follow the repo’s own architecture: packages own business logic, workflows orchestrate, apps compose and deliver. ([GitHub][3])

## The shortest delivery sequence

If you want this in a **few Codex passes**, I’d sequence it exactly like this:

1. **Finance workspace completion**
   timeline + execution-first UI, no major writes

2. **Execution recipe + leg-operation links**
   backend compiler and materialization

3. **Operations journal**
   `/treasury/operations` becomes day-to-day finance surface

4. **Execution commands**
   submit / retry / return / resolve blockers

5. **Reconciliation + close readiness + type hardening**
   correct closure for all four deal types

That is the plan I would approve for implementation. It uses the branch’s current strengths instead of redoing them, and it closes the actual finance gap: turning deals from pricing context into executable treasury work packages.

[1]: https://github.com/MPayments/bedrock/blob/mpayments-integration/packages/modules/deals/src/adapters/drizzle/schema.ts "https://github.com/MPayments/bedrock/blob/mpayments-integration/packages/modules/deals/src/adapters/drizzle/schema.ts"
[2]: https://github.com/MPayments/bedrock/blob/mpayments-integration/apps/finance/features/treasury/deals/labels.ts "https://github.com/MPayments/bedrock/blob/mpayments-integration/apps/finance/features/treasury/deals/labels.ts"
[3]: https://github.com/MPayments/bedrock/tree/mpayments-integration "GitHub - MPayments/bedrock at mpayments-integration · GitHub"
[4]: https://github.com/MPayments/bedrock/blob/mpayments-integration/apps/finance/features/treasury/deals/lib/queries.ts "https://github.com/MPayments/bedrock/blob/mpayments-integration/apps/finance/features/treasury/deals/lib/queries.ts"
[5]: https://github.com/MPayments/bedrock/blob/mpayments-integration/packages/modules/deals/src/domain/constants.ts "https://github.com/MPayments/bedrock/blob/mpayments-integration/packages/modules/deals/src/domain/constants.ts"
[6]: https://github.com/MPayments/bedrock/tree/mpayments-integration/apps/finance/app/%28shell%29/treasury "https://github.com/MPayments/bedrock/tree/mpayments-integration/apps/finance/app/%28shell%29/treasury"
