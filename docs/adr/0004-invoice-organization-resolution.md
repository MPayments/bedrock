# ADR 0004: Invoice Organization Resolution

## Status

Accepted

## Context

When generating an invoice print form for a deal, the system must decide *which* organization (and which of its bank requisites) is the issuer of that invoice.

The natural default source is the deal's `Agreement`: every agreement has both `organizationId` and `organizationRequisiteId`, fixed at signing. In a single-entity flow, the agreement signer is the invoice issuer.

Real flows are not always single-entity:

- multi-entity holdings sometimes sign customer agreements at a holding-level organization but issue invoices from a different operating organization
- a deal's payment route can have multiple legs (`PaymentStep`s), and each leg has its own `fromParty` / `fromParty.requisiteId` that may differ from the agreement's organization (see `packages/modules/treasury/src/payment-steps/contracts/dto.ts:103-130`)
- operators occasionally need to override the issuing organization for one-off scenarios via the invoice creation form

We therefore need a resolution strategy that:

1. preserves the agreement organization as the default
2. leaves a documented override slot for multi-entity / multi-leg cases
3. does not bake premature coupling between the invoice document and treasury payment steps

## Decision

`buildDealDocumentPrintContext` (`apps/api/src/routes/internal/print-forms.ts`) resolves invoice organization and requisite via a fixed cascade:

```
organizationId  =  document.payload.organizationId
                ?? workflow.participants[internal_entity].organizationId
                ?? agreement.organizationId

organizationRequisiteId  =  document.organizationRequisiteId
                        ?? document.payload.organizationRequisiteId
                        ?? agreement.organizationRequisiteId
```

The cascade preserves three layers of intent, in priority order:

### Layer 1 — explicit override via document payload

`document.payload.organizationId` and `document.payload.organizationRequisiteId` are populated only by the invoice creation form (`packages/plugins/documents-commercial/src/definitions/invoice.ts`). The form fields are optional. When the operator picks a specific organization or requisite, that selection wins.

This slot is reserved for two future use cases:

- **multi-entity manual override** — operator explicitly picks a non-agreement organization
- **payment-step preset (future)** — when an invoice is bound to a specific payment-step leg, the form will pre-fill `fromParty.id` / `fromParty.requisiteId` from that step. This integration lives in the form definition, not in `print-forms.ts`.

### Layer 2 — workflow internal_entity participant

The deal workflow records an `internal_entity` participant whose `organizationId` is initialized from `agreement.organizationId` at draft creation (`workflow-state.ts`) and is not mutated afterwards. This layer is currently a defensive duplicate of Layer 3 and exists to keep the resolver tolerant if the agreement record becomes stale during long-lived deals.

### Layer 3 — agreement default

Final fallback. For a single-entity flow with an empty form, this is the only layer that fires, and the invoice is issued from the agreement's organization.

## Consequences

- **Backwards-compatible default.** Operators who leave the invoice form fields untouched get an invoice from `agreement.organizationId` — matches the legacy single-entity expectation.
- **No tight coupling to payment-step.** The invoice document and `PaymentStep` remain independent. Linking them is a future feature implemented at the form level (preset selection) without touching `print-forms.ts`.
- **Operator override is auditable.** When `organizationId` differs from `agreement.organizationId`, the divergence is recorded in the invoice document's payload — visible to ops and audits.

## Alternatives considered

- **Strictly bind invoice to `agreement.organizationId`.** Rejected: removes the multi-entity escape hatch and would force schema/process workarounds in holdings that legitimately issue invoices from non-signing entities.
- **Read organization directly from a linked `PaymentStep`.** Rejected as premature: invoice creation today does not know about payment steps. Building the link is a separate, larger change. The payload override slot already supports the eventual integration without code rework in `print-forms.ts`.

## References

- ADR-0001 (bounded contexts and explicit architecture)
- ADR-0003 (route-driven deal execution)
- `apps/api/src/routes/internal/print-forms.ts` — `buildDealDocumentPrintContext`
- `packages/plugins/documents-commercial/src/definitions/invoice.ts` — invoice form definition with optional `organizationId` / `organizationRequisiteId`
- `packages/modules/treasury/src/payment-steps/contracts/dto.ts:103-130` — `PaymentStepPartyRefSchema` modelling per-leg party selection
