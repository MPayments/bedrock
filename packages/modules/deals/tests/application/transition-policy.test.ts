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
    header: {
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
    targetStatus: "pricing" as const,
  };
}

describe("deal transition policy", () => {
  it("blocks draft -> pricing when required header data is incomplete", () => {
    const input = createBaseInput();
    input.completeness[0] = {
      blockingReasons: ["Applicant is required"],
      complete: false,
      sectionId: "common",
    };

    const readiness = evaluateDealTransitionReadiness(input);

    expect(readiness.allowed).toBe(false);
    expect(
      readiness.blockers.some((blocker) => blocker.code === "header_incomplete"),
    ).toBe(true);
  });

  it("blocks pricing -> quoted when convert deal has no calculation", () => {
    const input = createBaseInput();
    input.header.type = "currency_exchange";
    input.header.moneyRequest.targetCurrencyId = "currency-2";
    input.status = "pricing";
    input.targetStatus = "quoted";

    const readiness = evaluateDealTransitionReadiness(input);

    expect(readiness.allowed).toBe(false);
    expect(
      readiness.blockers.some(
        (blocker) => blocker.code === "calculation_missing",
      ),
    ).toBe(true);
  });

  it("blocks awaiting_internal_approval -> approved_for_execution when the opening document is missing", () => {
    const input = createBaseInput();
    input.status = "awaiting_internal_approval";
    input.targetStatus = "approved_for_execution";
    input.calculationId = "calculation-1";
    input.approvals = [
      {
        approvalType: "commercial",
        comment: null,
        decidedAt: new Date("2026-04-01T09:30:00.000Z"),
        decidedBy: "user-1",
        id: "approval-commercial",
        requestedAt: new Date("2026-04-01T09:00:00.000Z"),
        requestedBy: "user-1",
        status: "approved",
      },
      {
        approvalType: "operations",
        comment: null,
        decidedAt: new Date("2026-04-01T09:45:00.000Z"),
        decidedBy: "user-2",
        id: "approval-operations",
        requestedAt: new Date("2026-04-01T09:05:00.000Z"),
        requestedBy: "user-2",
        status: "approved",
      },
    ];
    input.executionPlan = [
      createExecutionLeg(1, "collect", "ready"),
      createExecutionLeg(2, "payout", "ready"),
    ];

    const readiness = evaluateDealTransitionReadiness(input);

    expect(readiness.allowed).toBe(false);
    expect(
      readiness.blockers.some(
        (blocker) => blocker.code === "opening_document_missing",
      ),
    ).toBe(true);
  });

  it("allows awaiting_internal_approval -> approved_for_execution when the opening document is posted", () => {
    const input = createBaseInput();
    input.status = "awaiting_internal_approval";
    input.targetStatus = "approved_for_execution";
    input.header.moneyRequest.targetCurrencyId = "currency-2";
    input.calculationId = "calculation-1";
    input.approvals = [
      {
        approvalType: "commercial",
        comment: null,
        decidedAt: new Date("2026-04-01T09:30:00.000Z"),
        decidedBy: "user-1",
        id: "approval-commercial",
        requestedAt: new Date("2026-04-01T09:00:00.000Z"),
        requestedBy: "user-1",
        status: "approved",
      },
      {
        approvalType: "operations",
        comment: null,
        decidedAt: new Date("2026-04-01T09:45:00.000Z"),
        decidedBy: "user-2",
        id: "approval-operations",
        requestedAt: new Date("2026-04-01T09:05:00.000Z"),
        requestedBy: "user-2",
        status: "approved",
      },
    ];
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
    expect(readiness.blockers).toEqual([]);
  });

  it("allows pricing -> quoted when a calculation already exists", () => {
    const input = createBaseInput();
    input.status = "pricing";
    input.targetStatus = "quoted";
    input.calculationId = "calculation-1";

    const readiness = evaluateDealTransitionReadiness(input);

    expect(readiness.allowed).toBe(true);
    expect(readiness.blockers).toEqual([]);
  });

  it("blocks approved_for_execution -> executing when collect or convert legs are not done", () => {
    const input = createBaseInput();
    input.status = "approved_for_execution";
    input.targetStatus = "executing";
    input.calculationId = "calculation-1";
    input.approvals = [
      {
        approvalType: "commercial",
        comment: null,
        decidedAt: new Date("2026-04-01T09:30:00.000Z"),
        decidedBy: "user-1",
        id: "approval-commercial",
        requestedAt: new Date("2026-04-01T09:00:00.000Z"),
        requestedBy: "user-1",
        status: "approved",
      },
      {
        approvalType: "operations",
        comment: null,
        decidedAt: new Date("2026-04-01T09:45:00.000Z"),
        decidedBy: "user-2",
        id: "approval-operations",
        requestedAt: new Date("2026-04-01T09:05:00.000Z"),
        requestedBy: "user-2",
        status: "approved",
      },
    ];
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
