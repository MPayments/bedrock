# Route Composer Release Gate

This checklist is the concrete Phase 11 gate for the route-composer cutover. It maps the plan in `route-composer-plan.md` to the automated coverage and repo checks that now prove the feature is releasable.

## Gate Conditions

Release is blocked unless all of the following are true:

- Finance can compose, price, execute, reconcile, and close a deal on the deal-rooted flow.
- Finance can explicitly accept or supersede the current calculation without falling back to quote acceptance semantics.
- Finance can manually record normalized fills, fees, and cash movements directly from the execution workspace.
- CRM and Portal read only the deal-rooted projections.
- Realized P&L and reconciliation variance are visible in Finance and CRM.
- No legacy application-based pages or active routes remain in CRM, Portal, Finance, or API.
- `deals.headerSnapshot + headerRevision` remains the only canonical header persistence exception in this branch, and no new runtime code reads ad hoc JSON paths outside the deals module.
- The automated suites below pass on the release candidate branch.

## Automated Coverage

### Module tests

- Route validation: `/Users/alexey.eramasov/dev/ledger/packages/modules/deals/tests/application/route-validation.test.ts`
- Route template validation: `/Users/alexey.eramasov/dev/ledger/packages/modules/deals/tests/application/route-template-validation.test.ts`
- Calculation formula engine: `/Users/alexey.eramasov/dev/ledger/packages/modules/calculations/tests/domain/route-estimate.test.ts`
- Expected-vs-expected comparison snapshots: `/Users/alexey.eramasov/dev/ledger/packages/modules/calculations/tests/application/compare-calculations.test.ts`
- Execution fact normalization: `/Users/alexey.eramasov/dev/ledger/packages/modules/reconciliation/tests/execution-fact-normalization.test.ts`
- Close blockers and close-readiness policy: `/Users/alexey.eramasov/dev/ledger/packages/workflows/deal-projections/tests/close-readiness.test.ts`

### Integration and workflow tests

- Deal to calculation acceptance to execution plan: `packages/workflows/deal-projections/tests/service.test.ts`
- Execution materialization and close command behavior: `/Users/alexey.eramasov/dev/ledger/packages/workflows/deal-execution/tests/service.test.ts`
- Reconciliation normalization and run behavior: `/Users/alexey.eramasov/dev/ledger/packages/modules/reconciliation/tests/run-normalization.test.ts`
- Deal-rooted API routes and legacy route removal: `/Users/alexey.eramasov/dev/ledger/apps/api/tests/routes/deals.test.ts`
- Route composer API surface and lookup semantics: `/Users/alexey.eramasov/dev/ledger/apps/api/tests/routes/route-composer.test.ts`
- Participant lookup semantics: `/Users/alexey.eramasov/dev/ledger/apps/api/tests/routes/participants.test.ts`
- Document/accounting linkage for commercial documents: `/Users/alexey.eramasov/dev/ledger/packages/plugins/documents-commercial/tests/commercial-module-behavior.test.ts`

### UI tests

- Finance route composer workspace and page: `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-route-composer.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-route-composer-page.test.ts`
- Finance route template creation/list/detail flow: `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/route-template-workspace.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/route-template-page.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/route-templates-page.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/route-templates-queries.test.ts`
- Finance calculation workspace and page: `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-calculation-workspace.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-calculation-page.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-calculation-queries.test.ts`
- Finance execution manual-entry and reconciliation variance flow: `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-execution-workspace.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-execution-page.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-execution-queries.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-execution-actual-entry.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-reconciliation-workspace.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-reconciliation-page.test.ts`
- CRM summary and operator read model: `/Users/alexey.eramasov/dev/ledger/apps/crm/app/(dashboard)/deals/[id]/_components/deal-overview-tab.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/crm/app/(dashboard)/deals/[id]/_components/deal-profitability-card.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/crm/app/(dashboard)/deals/[id]/_components/deal-reconciliation-exceptions-card.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/crm/app/(dashboard)/deals/[id]/_components/deal-timeline-card.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/crm/app/(dashboard)/deals/[id]/_components/formal-documents-card.test.ts`
- Portal deal visibility flow: `/Users/alexey.eramasov/dev/ledger/apps/portal/tests/deal-visibility.test.ts`

### End-to-end acceptance

- Supplier payment flow with route pricing, execution, reconciliation, and close: `/Users/alexey.eramasov/dev/ledger/tests/e2e/deal-payment.spec.ts`

## Scenario Map

The staging scenarios from the plan are covered as follows:

1. Supplier payment with internal transfer and FX: end-to-end in `/Users/alexey.eramasov/dev/ledger/tests/e2e/deal-payment.spec.ts`
2. Currency transit: route validation and close-readiness policy in `/Users/alexey.eramasov/dev/ledger/packages/modules/deals/tests/application/route-validation.test.ts` and `/Users/alexey.eramasov/dev/ledger/packages/workflows/deal-projections/tests/close-readiness.test.ts`
3. Currency exchange: calculation accept/supersede flow, execution workspace variance, and workflow service coverage in `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-calculation-workspace.test.ts`, `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-execution-workspace.test.ts`, and `/Users/alexey.eramasov/dev/ledger/packages/workflows/deal-execution/tests/service.test.ts`
4. Exporter settlement: route validation plus close blockers in `/Users/alexey.eramasov/dev/ledger/packages/modules/deals/tests/application/route-validation.test.ts` and `/Users/alexey.eramasov/dev/ledger/packages/workflows/deal-projections/tests/close-readiness.test.ts`
5. Sub-agent commission case: participant lookup semantics and route composer API coverage in `/Users/alexey.eramasov/dev/ledger/apps/api/tests/routes/participants.test.ts` and `/Users/alexey.eramasov/dev/ledger/apps/api/tests/routes/route-composer.test.ts`
6. Mixed fixed and percentage cost lines: route estimate and calculation comparison in `/Users/alexey.eramasov/dev/ledger/packages/modules/calculations/tests/domain/route-estimate.test.ts` and `/Users/alexey.eramasov/dev/ledger/packages/modules/calculations/tests/application/compare-calculations.test.ts`
7. Reconciliation exception blocks close: reconciliation workspace and close-readiness tests in `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-reconciliation-workspace.test.ts` and `/Users/alexey.eramasov/dev/ledger/packages/workflows/deal-projections/tests/close-readiness.test.ts`
8. Lookup semantics for route composer: `/Users/alexey.eramasov/dev/ledger/apps/api/tests/routes/participants.test.ts` and `/Users/alexey.eramasov/dev/ledger/apps/api/tests/routes/route-composer.test.ts`
9. Manual normalized actual entry: `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-execution-actual-entry.test.ts` and `/Users/alexey.eramasov/dev/ledger/apps/finance/tests/treasury-deal-execution-workspace.test.ts`

## Suggested Verification Commands

Run these commands on the release candidate branch:

```bash
bun run test -- \
  "packages/modules/deals/tests/application/route-validation.test.ts" \
  "packages/modules/deals/tests/application/route-template-validation.test.ts" \
  "packages/modules/calculations/tests/domain/route-estimate.test.ts" \
  "packages/modules/calculations/tests/application/compare-calculations.test.ts" \
  "packages/modules/reconciliation/tests/execution-fact-normalization.test.ts" \
  "packages/workflows/deal-projections/tests/close-readiness.test.ts" \
  "packages/workflows/deal-projections/tests/service.test.ts" \
  "packages/workflows/deal-execution/tests/service.test.ts" \
  "packages/modules/reconciliation/tests/run-normalization.test.ts" \
  "apps/api/tests/routes/deals.test.ts" \
  "apps/api/tests/routes/route-composer.test.ts" \
  "apps/api/tests/routes/participants.test.ts" \
  "apps/finance/tests/treasury-deal-route-composer.test.ts" \
  "apps/finance/tests/route-template-workspace.test.ts" \
  "apps/finance/tests/treasury-deal-calculation-workspace.test.ts" \
  "apps/finance/tests/treasury-deal-execution-workspace.test.ts" \
  "apps/finance/tests/treasury-deal-reconciliation-workspace.test.ts" \
  "apps/crm/app/(dashboard)/deals/[id]/_components/deal-overview-tab.test.ts" \
  "apps/portal/tests/deal-visibility.test.ts"
```

```bash
bun run check-types --filter=finance
bun run check-types --filter=crm
bun run check-types --filter=portal
bun run build --filter=api
```

```bash
bunx playwright test tests/e2e/deal-payment.spec.ts
```

The cutover is only releasable when those commands pass without re-enabling any application-based route, page, or table path.

## Merge-Time Exception

For this branch only, the canonical deal header is still persisted as typed `deals.headerSnapshot + headerRevision`.
That is an explicit storage exception, not a license to reintroduce intake-style compatibility layers.
The supported runtime contract remains typed `DealHeader`, and accepted calculation remains the commercial freeze point instead of accepted quote state.
