import { describe, expect, it } from "vitest";

import type { PaymentRouteDraft } from "@bedrock/treasury/contracts";

import type { DealIntakeDraft } from "../../src/application/contracts/dto";
import {
  buildDealExecutionPlan,
  buildEffectiveDealExecutionPlan,
  deriveDealNextAction,
  evaluateDealSectionCompleteness,
} from "../../src/domain/workflow";

describe("deal workflow", () => {
  it("does not require money request purpose for payment deals", () => {
    const completeness = evaluateDealSectionCompleteness({
      common: {
        applicantCounterpartyId: "applicant-1",
        customerNote: null,
        requestedExecutionDate: new Date("2026-04-05T00:00:00.000Z"),
      },
      externalBeneficiary: {
        bankInstructionSnapshot: {
          accountNo: "DE89370400440532013000",
          bankAddress: null,
          bankCountry: "DE",
          bankName: "Beneficiary Bank",
          beneficiaryName: "Beneficiary GmbH",
          bic: "DEUTDEFF",
          iban: "DE89370400440532013000",
          label: "Main payout bank",
          swift: "DEUTDEFF",
        },
        beneficiaryCounterpartyId: "beneficiary-1",
        beneficiarySnapshot: null,
      },
      incomingReceipt: {
        contractNumber: null,
        expectedAmount: "1000.00",
        expectedAt: null,
        invoiceNumber: null,
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: null,
        sourceAmount: null,
        sourceCurrencyId: "currency-1",
        targetCurrencyId: "currency-2",
      },
      settlementDestination: {
        bankInstructionSnapshot: null,
        mode: null,
        requisiteId: null,
      },
      type: "payment",
    });

    expect(completeness.find((section) => section.sectionId === "moneyRequest"))
      .toEqual({
        blockingReasons: [],
        complete: true,
        sectionId: "moneyRequest",
      });
  });

  it("uses the nearest transition blockers when deriving next action", () => {
    const nextAction = deriveDealNextAction({
      acceptance: {
        acceptedAt: new Date("2026-04-05T08:55:08.683Z"),
        acceptedByUserId: "user-1",
        agreementVersionId: null,
        dealId: "deal-1",
        dealRevision: 3,
        expiresAt: new Date("2026-04-06T08:54:00.000Z"),
        id: "acceptance-1",
        quoteId: "quote-1",
        quoteStatus: "used",
        replacedByQuoteId: null,
        revokedAt: null,
        usedAt: new Date("2026-04-05T08:57:22.536Z"),
        usedDocumentId: "doc-1",
      },
      calculationId: "calculation-1",
      completeness: [
        {
          blockingReasons: [],
          complete: true,
          sectionId: "common",
        },
        {
          blockingReasons: [],
          complete: true,
          sectionId: "moneyRequest",
        },
        {
          blockingReasons: [],
          complete: true,
          sectionId: "externalBeneficiary",
        },
      ],
      intake: {
        common: {
          applicantCounterpartyId: "applicant-1",
          customerNote: null,
          requestedExecutionDate: new Date("2026-04-05T00:00:00.000Z"),
        },
        externalBeneficiary: {
          bankInstructionSnapshot: {
            accountNo: "DE89370400440532013000",
            bankAddress: null,
            bankCountry: "DE",
            bankName: "Beneficiary Bank",
            beneficiaryName: "Beneficiary GmbH",
            bic: "DEUTDEFF",
            iban: "DE89370400440532013000",
            label: "Main payout bank",
            swift: "DEUTDEFF",
          },
          beneficiaryCounterpartyId: "beneficiary-1",
          beneficiarySnapshot: null,
        },
        incomingReceipt: {
          contractNumber: null,
          expectedAmount: "1000.00",
          expectedAt: null,
          invoiceNumber: null,
          payerCounterpartyId: null,
          payerSnapshot: null,
        },
        moneyRequest: {
          purpose: null,
          sourceAmount: null,
          sourceCurrencyId: "currency-1",
          targetCurrencyId: "currency-2",
        },
        settlementDestination: {
          bankInstructionSnapshot: null,
          mode: null,
          requisiteId: null,
        },
        type: "payment",
      },
      status: "preparing_documents",
      transitionReadiness: [
        {
          allowed: true,
          blockers: [],
          targetStatus: "awaiting_funds",
        },
        {
          allowed: false,
          blockers: [
            {
              code: "operational_position_incomplete",
              message: "Operational position is not ready: customer_receivable",
            },
          ],
          targetStatus: "awaiting_payment",
        },
      ],
    });

    expect(nextAction).toBe("Continue processing");
  });

  it("marks the payment convert leg done after a posted exchange document exists", () => {
    const executionPlan = buildEffectiveDealExecutionPlan({
      acceptance: null,
      documents: [
        {
          approvalStatus: "not_required",
          createdAt: new Date("2026-04-05T09:00:00.000Z"),
          docType: "exchange",
          id: "document-1",
          lifecycleStatus: "active",
          occurredAt: new Date("2026-04-05T09:00:00.000Z"),
          postingStatus: "posted",
          submissionStatus: "submitted",
        },
      ],
      fundingResolution: {
        availableMinor: "1450000",
        fundingOrganizationId: "00000000-0000-4000-8000-000000000001",
        fundingRequisiteId: "00000000-0000-4000-8000-000000000002",
        reasonCode: null,
        requiredAmountMinor: "1450000",
        state: "resolved",
        strategy: "external_fx",
        targetCurrency: "USD",
        targetCurrencyId: "00000000-0000-4000-8000-000000000003",
      },
      intake: {
        common: {
          applicantCounterpartyId: "applicant-1",
          customerNote: null,
          requestedExecutionDate: new Date("2026-04-05T00:00:00.000Z"),
        },
        externalBeneficiary: {
          bankInstructionSnapshot: {
            accountNo: "AE640970000000103000009876543210",
            bankAddress: null,
            bankCountry: "AE",
            bankName: "Dubai Islamic Bank",
            beneficiaryName: "ALMUTLAG GENERAL TRADING LLC",
            bic: "DUIBAEAD",
            iban: "AE640970000000103000009876543210",
            label: "Primary beneficiary account",
            swift: "DUIBAEAD",
          },
          beneficiaryCounterpartyId: "beneficiary-1",
          beneficiarySnapshot: null,
        },
        incomingReceipt: {
          contractNumber: "WP-PO-2026-001",
          expectedAmount: "14500.00",
          expectedAt: null,
          invoiceNumber: "WP-INV-2026-001",
          payerCounterpartyId: "payer-1",
          payerSnapshot: null,
        },
        moneyRequest: {
          purpose: "Payment for invoice WP-INV-2026-001",
          sourceAmount: "14500.00",
          sourceCurrencyId: "currency-aed",
          targetCurrencyId: "currency-usd",
        },
        settlementDestination: {
          bankInstructionSnapshot: null,
          mode: null,
          requisiteId: null,
        },
        type: "payment",
      },
      now: new Date("2026-04-05T10:00:00.000Z"),
      routeSnapshot: null,
      storedLegs: [],
    });

    expect(executionPlan.find((leg) => leg.kind === "convert")?.state).toBe(
      "done",
    );
  });
});

function createPaymentIntake(override?: Partial<DealIntakeDraft>): DealIntakeDraft {
  return {
    common: {
      applicantCounterpartyId: "applicant-1",
      customerNote: null,
      requestedExecutionDate: new Date("2026-04-05T00:00:00.000Z"),
    },
    externalBeneficiary: {
      bankInstructionSnapshot: null,
      beneficiaryCounterpartyId: null,
      beneficiarySnapshot: null,
    },
    incomingReceipt: {
      contractNumber: null,
      expectedAmount: "1000000.00",
      expectedAt: null,
      invoiceNumber: null,
      payerCounterpartyId: null,
      payerSnapshot: null,
    },
    moneyRequest: {
      purpose: null,
      sourceAmount: "1000000.00",
      sourceCurrencyId: "currency-rub",
      targetCurrencyId: "currency-usd",
    },
    settlementDestination: {
      bankInstructionSnapshot: null,
      mode: null,
      requisiteId: null,
    },
    type: "payment",
    ...override,
  };
}

function createFourHopRouteSnapshot(): PaymentRouteDraft {
  return {
    additionalFees: [],
    amountInMinor: "100000000",
    amountOutMinor: "10000000",
    currencyInId: "currency-rub",
    currencyOutId: "currency-usd",
    legs: [
      {
        fees: [],
        fromCurrencyId: "currency-rub",
        id: "route-leg-1",
        toCurrencyId: "currency-rub",
      },
      {
        fees: [],
        fromCurrencyId: "currency-rub",
        id: "route-leg-2",
        toCurrencyId: "currency-aed",
      },
      {
        fees: [],
        fromCurrencyId: "currency-aed",
        id: "route-leg-3",
        toCurrencyId: "currency-aed",
      },
      {
        fees: [],
        fromCurrencyId: "currency-aed",
        id: "route-leg-4",
        toCurrencyId: "currency-usd",
      },
    ],
    lockedSide: "currency_out",
    participants: [
      {
        binding: "abstract",
        displayName: "Payer",
        entityId: null,
        entityKind: null,
        nodeId: "node-source",
        requisiteId: null,
        role: "source",
      },
      {
        binding: "abstract",
        displayName: "Hop 1",
        entityId: null,
        entityKind: null,
        nodeId: "node-hop-1",
        requisiteId: null,
        role: "hop",
      },
      {
        binding: "abstract",
        displayName: "Hop 2",
        entityId: null,
        entityKind: null,
        nodeId: "node-hop-2",
        requisiteId: null,
        role: "hop",
      },
      {
        binding: "abstract",
        displayName: "Hop 3",
        entityId: null,
        entityKind: null,
        nodeId: "node-hop-3",
        requisiteId: null,
        role: "hop",
      },
      {
        binding: "abstract",
        displayName: "Beneficiary",
        entityId: null,
        entityKind: null,
        nodeId: "node-destination",
        requisiteId: null,
        role: "destination",
      },
    ],
  };
}

describe("buildDealExecutionPlan — route-derived", () => {
  it("returns the canonical 3-leg fallback for a payment deal when no route is attached", () => {
    const plan = buildDealExecutionPlan(createPaymentIntake(), null);

    expect(plan.map((leg) => leg.kind)).toEqual([
      "collect",
      "convert",
      "payout",
    ]);
    expect(plan.every((leg) => leg.routeSnapshotLegId === null)).toBe(true);
  });

  it("derives 6 legs from a 4-hop route snapshot on a payment deal", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildDealExecutionPlan(createPaymentIntake(), snapshot);

    expect(plan.map((leg) => leg.kind)).toEqual([
      "collect",
      "transit_hold",
      "convert",
      "transit_hold",
      "convert",
      "payout",
    ]);
    expect(plan.map((leg) => leg.idx)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plan.slice(1, -1).map((leg) => leg.routeSnapshotLegId)).toEqual([
      "route-leg-1",
      "route-leg-2",
      "route-leg-3",
      "route-leg-4",
    ]);
    expect(plan.slice(1, -1).map((leg) => leg.fromCurrencyId)).toEqual([
      "currency-rub",
      "currency-rub",
      "currency-aed",
      "currency-aed",
    ]);
    expect(plan.slice(1, -1).map((leg) => leg.toCurrencyId)).toEqual([
      "currency-rub",
      "currency-aed",
      "currency-aed",
      "currency-usd",
    ]);
    // collect and payout inherit the deal's source/target currencies
    expect(plan[0]?.fromCurrencyId).toBe("currency-rub");
    expect(plan[0]?.toCurrencyId).toBe("currency-rub");
    expect(plan[plan.length - 1]?.fromCurrencyId).toBe("currency-usd");
    expect(plan[plan.length - 1]?.toCurrencyId).toBe("currency-usd");
  });

  it("uses route hops with exporter_settlement bookends", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildDealExecutionPlan(
      createPaymentIntake({ type: "exporter_settlement" }),
      snapshot,
    );

    expect(plan.map((leg) => leg.kind)).toEqual([
      "payout",
      "collect",
      "transit_hold",
      "convert",
      "transit_hold",
      "convert",
      "settle_exporter",
    ]);
    expect(plan.map((leg) => leg.idx)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("buildEffectiveDealExecutionPlan — per-convert state rules", () => {
  const baseInput = {
    acceptance: null,
    documents: [],
    fundingResolution: {
      availableMinor: null,
      fundingOrganizationId: null,
      fundingRequisiteId: null,
      reasonCode: null,
      requiredAmountMinor: null,
      state: "not_applicable" as const,
      strategy: null,
      targetCurrency: null,
      targetCurrencyId: null,
    },
    now: new Date("2026-04-05T10:00:00.000Z"),
    storedLegs: [],
  };

  it("marks every convert leg skipped when funding is existing_inventory", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildEffectiveDealExecutionPlan({
      ...baseInput,
      fundingResolution: {
        availableMinor: "10000000",
        fundingOrganizationId: "org-1",
        fundingRequisiteId: "req-1",
        reasonCode: "inventory_available",
        requiredAmountMinor: "10000000",
        state: "resolved",
        strategy: "existing_inventory",
        targetCurrency: "USD",
        targetCurrencyId: "currency-usd",
      },
      intake: createPaymentIntake(),
      routeSnapshot: snapshot,
    });

    const convertLegs = plan.filter((leg) => leg.kind === "convert");
    expect(convertLegs.length).toBe(2);
    expect(convertLegs.every((leg) => leg.state === "skipped")).toBe(true);
  });

  it("marks every convert leg done when exchange document is posted", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildEffectiveDealExecutionPlan({
      ...baseInput,
      documents: [
        {
          approvalStatus: "not_required",
          createdAt: new Date("2026-04-05T09:00:00.000Z"),
          docType: "exchange",
          id: "doc-1",
          lifecycleStatus: "active",
          occurredAt: new Date("2026-04-05T09:00:00.000Z"),
          postingStatus: "posted",
          submissionStatus: "submitted",
        },
      ],
      intake: createPaymentIntake(),
      routeSnapshot: snapshot,
    });

    const convertLegs = plan.filter((leg) => leg.kind === "convert");
    expect(convertLegs.length).toBe(2);
    expect(convertLegs.every((leg) => leg.state === "done")).toBe(true);
  });

  it("preserves stored leg state via routeSnapshotLegId match after re-materialization", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildEffectiveDealExecutionPlan({
      ...baseInput,
      intake: createPaymentIntake(),
      routeSnapshot: snapshot,
      storedLegs: [
        {
          fromCurrencyId: "currency-rub",
          id: "stored-leg-id-1",
          idx: 99, // intentionally different idx — match-by-snapshot-id should still work
          kind: "transit_hold",
          operationRefs: [],
          routeSnapshotLegId: "route-leg-1",
          state: "done",
          toCurrencyId: "currency-rub",
        },
      ],
    });

    const matched = plan.find(
      (leg) => leg.routeSnapshotLegId === "route-leg-1",
    );
    expect(matched?.state).toBe("done");
    expect(matched?.id).toBe("stored-leg-id-1");
    expect(matched?.idx).toBe(2); // re-indexed by new plan, not the stale stored idx
  });
});

describe("buildEffectiveDealExecutionPlan — step-derived leg state", () => {
  const baseInput = {
    acceptance: null,
    documents: [],
    fundingResolution: {
      availableMinor: null,
      fundingOrganizationId: null,
      fundingRequisiteId: null,
      reasonCode: null,
      requiredAmountMinor: null,
      state: "not_applicable" as const,
      strategy: null,
      targetCurrency: null,
      targetCurrencyId: null,
    },
    now: new Date("2026-04-05T10:00:00.000Z"),
    storedLegs: [],
  };

  it("derives every leg as done when each leg has a completed payment step", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildEffectiveDealExecutionPlan({
      ...baseInput,
      intake: createPaymentIntake(),
      paymentSteps: [
        { dealLegIdx: 1, state: "completed" },
        { dealLegIdx: 2, state: "completed" },
        { dealLegIdx: 3, state: "completed" },
        { dealLegIdx: 4, state: "completed" },
        { dealLegIdx: 5, state: "completed" },
        { dealLegIdx: 6, state: "completed" },
      ],
      routeSnapshot: snapshot,
    });

    expect(plan.every((leg) => leg.state === "done")).toBe(true);
  });

  it("derives leg as in_progress when its step is processing", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildEffectiveDealExecutionPlan({
      ...baseInput,
      intake: createPaymentIntake(),
      paymentSteps: [{ dealLegIdx: 1, state: "processing" }],
      routeSnapshot: snapshot,
    });

    const leg = plan.find((entry) => entry.idx === 1);
    expect(leg?.state).toBe("in_progress");
  });

  it("derives leg as ready when its step is draft (materialized but no action yet)", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildEffectiveDealExecutionPlan({
      ...baseInput,
      intake: createPaymentIntake(),
      paymentSteps: [{ dealLegIdx: 1, state: "draft" }],
      routeSnapshot: snapshot,
    });

    const leg = plan.find((entry) => entry.idx === 1);
    expect(leg?.state).toBe("ready");
  });

  it("derives leg as blocked when any step failed", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildEffectiveDealExecutionPlan({
      ...baseInput,
      intake: createPaymentIntake(),
      paymentSteps: [{ dealLegIdx: 1, state: "failed" }],
      routeSnapshot: snapshot,
    });

    const leg = plan.find((entry) => entry.idx === 1);
    expect(leg?.state).toBe("blocked");
  });

  it("derives leg as skipped when only cancelled/skipped steps exist", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildEffectiveDealExecutionPlan({
      ...baseInput,
      intake: createPaymentIntake(),
      paymentSteps: [{ dealLegIdx: 1, state: "cancelled" }],
      routeSnapshot: snapshot,
    });

    const leg = plan.find((entry) => entry.idx === 1);
    expect(leg?.state).toBe("skipped");
  });

  it("falls back to existing rules when no payment steps exist for a leg", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildEffectiveDealExecutionPlan({
      ...baseInput,
      intake: createPaymentIntake(),
      paymentSteps: [],
      routeSnapshot: snapshot,
    });

    expect(plan.every((leg) => leg.state === "pending")).toBe(true);
  });

  it("derives leg as in_progress when one step is completed but others are still processing", () => {
    const snapshot = createFourHopRouteSnapshot();
    const plan = buildEffectiveDealExecutionPlan({
      ...baseInput,
      intake: createPaymentIntake(),
      paymentSteps: [
        { dealLegIdx: 1, state: "completed" },
        { dealLegIdx: 1, state: "processing" },
      ],
      routeSnapshot: snapshot,
    });

    const leg = plan.find((entry) => entry.idx === 1);
    expect(leg?.state).toBe("in_progress");
  });
});
