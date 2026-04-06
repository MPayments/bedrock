import { describe, expect, it } from "vitest";

import { evaluateDealTransitionReadiness } from "../../src/domain/transition-policy";

function createExecutionLeg(
  idx: number,
  kind: "collect" | "convert" | "payout",
  state: "pending" | "ready" | "in_progress",
) {
  return {
    id: `leg-${idx}`,
    idx,
    kind,
    operationRefs: [],
    state,
  };
}

function createBaseInput() {
  return {
    acceptance: null,
    approvals: [],
    calculationId: null,
    completeness: [
      {
        blockingReasons: [],
        complete: true,
        sectionId: "common" as const,
      },
      {
        blockingReasons: [],
        complete: true,
        sectionId: "moneyRequest" as const,
      },
      {
        blockingReasons: [],
        complete: true,
        sectionId: "externalBeneficiary" as const,
      },
      {
        blockingReasons: [],
        complete: true,
        sectionId: "incomingReceipt" as const,
      },
      {
        blockingReasons: [],
        complete: true,
        sectionId: "settlementDestination" as const,
      },
    ],
    documents: [],
    executionPlan: [
      createExecutionLeg(1, "collect", "pending"),
      createExecutionLeg(2, "convert", "pending"),
      createExecutionLeg(3, "payout", "pending"),
    ],
    intake: {
      externalBeneficiary: { beneficiarySnapshot: null },
      incomingReceipt: { payerSnapshot: null },
      moneyRequest: {
        sourceCurrencyId: "currency-1",
        targetCurrencyId: null,
      },
      type: "payment" as const,
    },
    now: new Date("2026-04-01T12:00:00.000Z"),
    operationalState: {
      capabilities: [
        {
          applicantCounterpartyId: "applicant-1",
          dealType: "payment" as const,
          internalEntityOrganizationId: "org-1",
          kind: "can_collect" as const,
          note: null,
          reasonCode: null,
          status: "enabled" as const,
          updatedAt: new Date("2026-04-01T11:00:00.000Z"),
          updatedByUserId: "user-1",
        },
        {
          applicantCounterpartyId: "applicant-1",
          dealType: "payment" as const,
          internalEntityOrganizationId: "org-1",
          kind: "can_payout" as const,
          note: null,
          reasonCode: null,
          status: "enabled" as const,
          updatedAt: new Date("2026-04-01T11:00:00.000Z"),
          updatedByUserId: "user-1",
        },
      ],
      positions: [
        {
          amountMinor: null,
          currencyId: null,
          kind: "customer_receivable" as const,
          reasonCode: null,
          sourceRefs: ["leg:1:collect"],
          state: "ready" as const,
          updatedAt: new Date("2026-04-01T11:00:00.000Z"),
        },
        {
          amountMinor: null,
          currencyId: null,
          kind: "provider_payable" as const,
          reasonCode: null,
          sourceRefs: ["leg:3:payout"],
          state: "ready" as const,
          updatedAt: new Date("2026-04-01T11:00:00.000Z"),
        },
        {
          amountMinor: null,
          currencyId: null,
          kind: "intercompany_due_from" as const,
          reasonCode: null,
          sourceRefs: [],
          state: "not_applicable" as const,
          updatedAt: null,
        },
        {
          amountMinor: null,
          currencyId: null,
          kind: "intercompany_due_to" as const,
          reasonCode: null,
          sourceRefs: [],
          state: "not_applicable" as const,
          updatedAt: null,
        },
        {
          amountMinor: null,
          currencyId: null,
          kind: "in_transit" as const,
          reasonCode: null,
          sourceRefs: [],
          state: "not_applicable" as const,
          updatedAt: null,
        },
        {
          amountMinor: null,
          currencyId: null,
          kind: "suspense" as const,
          reasonCode: null,
          sourceRefs: [],
          state: "not_applicable" as const,
          updatedAt: null,
        },
        {
          amountMinor: null,
          currencyId: null,
          kind: "exporter_expected_receivable" as const,
          reasonCode: null,
          sourceRefs: [],
          state: "not_applicable" as const,
          updatedAt: null,
        },
        {
          amountMinor: null,
          currencyId: null,
          kind: "fee_revenue" as const,
          reasonCode: "calculation_missing",
          sourceRefs: [],
          state: "pending" as const,
          updatedAt: new Date("2026-04-01T11:00:00.000Z"),
        },
        {
          amountMinor: null,
          currencyId: null,
          kind: "spread_revenue" as const,
          reasonCode: "calculation_missing",
          sourceRefs: [],
          state: "pending" as const,
          updatedAt: new Date("2026-04-01T11:00:00.000Z"),
        },
      ],
    },
    participants: [
      {
        counterpartyId: null,
        customerId: "customer-1",
        displayName: "Customer",
        id: "participant-customer",
        organizationId: null,
        role: "customer" as const,
      },
      {
        counterpartyId: "applicant-1",
        customerId: null,
        displayName: "Applicant",
        id: "participant-applicant",
        organizationId: null,
        role: "applicant" as const,
      },
      {
        counterpartyId: null,
        customerId: null,
        displayName: "Internal Entity",
        id: "participant-internal",
        organizationId: "org-1",
        role: "internal_entity" as const,
      },
      {
        counterpartyId: "beneficiary-1",
        customerId: null,
        displayName: "Beneficiary",
        id: "participant-beneficiary",
        organizationId: null,
        role: "external_beneficiary" as const,
      },
    ],
    status: "draft" as const,
    targetStatus: "submitted" as const,
  };
}

describe("deal transition policy", () => {
  it("blocks draft -> submitted when required intake is incomplete", () => {
    const input = createBaseInput();
    input.completeness[0] = {
      blockingReasons: ["Applicant is required"],
      complete: false,
      sectionId: "common",
    };

    const readiness = evaluateDealTransitionReadiness(input);

    expect(readiness.allowed).toBe(false);
    expect(readiness.blockers.some((blocker) => blocker.code === "intake_incomplete")).toBe(true);
  });

  it("blocks submitted -> preparing_documents when convert deal has no accepted quote", () => {
    const input = createBaseInput();
    input.intake.type = "currency_exchange";
    input.intake.moneyRequest.targetCurrencyId = "currency-2";
    input.status = "submitted";
    input.targetStatus = "preparing_documents";
    input.operationalState.capabilities = [
      {
        applicantCounterpartyId: "applicant-1",
        dealType: "currency_exchange",
        internalEntityOrganizationId: "org-1",
        kind: "can_collect",
        note: null,
        reasonCode: null,
        status: "enabled",
        updatedAt: new Date("2026-04-01T11:00:00.000Z"),
        updatedByUserId: "user-1",
      },
      {
        applicantCounterpartyId: "applicant-1",
        dealType: "currency_exchange",
        internalEntityOrganizationId: "org-1",
        kind: "can_fx",
        note: null,
        reasonCode: null,
        status: "enabled",
        updatedAt: new Date("2026-04-01T11:00:00.000Z"),
        updatedByUserId: "user-1",
      },
      {
        applicantCounterpartyId: "applicant-1",
        dealType: "currency_exchange",
        internalEntityOrganizationId: "org-1",
        kind: "can_payout",
        note: null,
        reasonCode: null,
        status: "enabled",
        updatedAt: new Date("2026-04-01T11:00:00.000Z"),
        updatedByUserId: "user-1",
      },
    ];

    const readiness = evaluateDealTransitionReadiness(input);

    expect(readiness.allowed).toBe(false);
    expect(readiness.blockers.some((blocker) => blocker.code === "accepted_quote_missing")).toBe(true);
    expect(readiness.blockers.some((blocker) => blocker.code === "calculation_missing")).toBe(true);
  });

  it("blocks preparing_documents -> awaiting_funds when the opening document is missing", () => {
    const input = createBaseInput();
    input.status = "preparing_documents";
    input.targetStatus = "awaiting_funds";
    input.executionPlan = [
      createExecutionLeg(1, "collect", "ready"),
      createExecutionLeg(2, "payout", "ready"),
    ];

    const readiness = evaluateDealTransitionReadiness(input);

    expect(readiness.allowed).toBe(false);
    expect(readiness.blockers.some((blocker) => blocker.code === "opening_document_missing")).toBe(true);
  });

  it("allows preparing_documents -> awaiting_funds when the accepted quote is already used and the opening document is posted", () => {
    const input = createBaseInput();
    input.status = "preparing_documents";
    input.targetStatus = "awaiting_funds";
    input.intake.moneyRequest.targetCurrencyId = "currency-2";
    input.acceptance = {
      acceptedAt: new Date("2026-04-01T10:00:00.000Z"),
      acceptedByUserId: "user-1",
      agreementVersionId: null,
      dealId: "deal-1",
      dealRevision: 2,
      expiresAt: new Date("2026-04-02T10:00:00.000Z"),
      id: "acceptance-1",
      quoteId: "quote-1",
      quoteStatus: "used",
      replacedByQuoteId: null,
      revokedAt: null,
      usedAt: new Date("2026-04-01T10:05:00.000Z"),
      usedDocumentId: "doc-1",
    };
    input.calculationId = "calculation-1";
    input.documents = [
      {
        approvalStatus: "approved",
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        docType: "invoice",
        id: "doc-1",
        lifecycleStatus: "active",
        occurredAt: new Date("2026-04-01T10:00:00.000Z"),
        postingStatus: "posted",
        submissionStatus: "submitted",
      },
    ];
    input.executionPlan = [
      createExecutionLeg(1, "collect", "pending"),
      {
        ...createExecutionLeg(2, "convert", "pending"),
        state: "done",
      },
      createExecutionLeg(3, "payout", "pending"),
    ];

    const readiness = evaluateDealTransitionReadiness(input);

    expect(readiness.allowed).toBe(true);
    expect(
      readiness.blockers.some(
        (blocker) => blocker.code === "accepted_quote_inactive",
      ),
    ).toBe(false);
  });

  it("blocks submitted -> preparing_documents when a required capability is disabled", () => {
    const input = createBaseInput();
    input.status = "submitted";
    input.targetStatus = "preparing_documents";
    input.operationalState.capabilities[1] = {
      ...input.operationalState.capabilities[1]!,
      reasonCode: "manual_hold",
      status: "disabled",
    };

    const readiness = evaluateDealTransitionReadiness(input);

    expect(readiness.allowed).toBe(false);
    expect(
      readiness.blockers.some((blocker) => blocker.code === "capability_disabled"),
    ).toBe(true);
  });

  it("blocks awaiting_funds -> awaiting_payment when collect or convert legs are not done", () => {
    const input = createBaseInput();
    input.status = "awaiting_funds";
    input.targetStatus = "awaiting_payment";
    input.documents = [
      {
        approvalStatus: "approved",
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        docType: "invoice",
        id: "doc-1",
        lifecycleStatus: "active",
        occurredAt: new Date("2026-04-01T10:00:00.000Z"),
        postingStatus: "posted",
        submissionStatus: "submitted",
      },
    ];
    input.executionPlan = [
      createExecutionLeg(1, "collect", "in_progress"),
      createExecutionLeg(2, "convert", "ready"),
      createExecutionLeg(3, "payout", "ready"),
    ];
    input.operationalState.positions[0] = {
      ...input.operationalState.positions[0]!,
      reasonCode: "execution_pending",
      state: "in_progress",
    };

    const readiness = evaluateDealTransitionReadiness(input);

    expect(readiness.allowed).toBe(false);
    expect(readiness.blockers.some((blocker) => blocker.code === "execution_leg_not_done")).toBe(true);
    expect(
      readiness.blockers.some(
        (blocker) => blocker.code === "operational_position_incomplete",
      ),
    ).toBe(true);
  });
});
