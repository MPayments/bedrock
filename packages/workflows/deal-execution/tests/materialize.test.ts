import { describe, expect, it, vi } from "vitest";

import type { CompiledDealExecutionOperation } from "../src/recipe";
import {
  materializeCompiledOperation,
  resolveLegPartyRefs,
} from "../src/shared/materialize";

interface Participant {
  counterpartyId: string | null;
  customerId: string | null;
  displayName: string | null;
  id: string;
  organizationId: string | null;
  role:
    | "customer"
    | "applicant"
    | "internal_entity"
    | "external_payer"
    | "external_beneficiary";
}

function createWorkflow(input?: { participants?: Participant[] }): any {
  return {
    executionPlan: [],
    participants: input?.participants ?? [
      {
        counterpartyId: null,
        customerId: "customer-1",
        displayName: "Customer",
        id: "participant-customer",
        organizationId: null,
        role: "customer",
      },
      {
        counterpartyId: null,
        customerId: null,
        displayName: "Beneficiary",
        id: "participant-beneficiary",
        organizationId: null,
        role: "external_beneficiary",
      },
    ],
    intake: {
      common: { applicantCounterpartyId: null, customerNote: null },
      externalBeneficiary: {
        beneficiaryCounterpartyId: null,
        beneficiarySnapshot: null,
      },
      incomingReceipt: {
        contractNumber: null,
        expectedAmount: null,
        expectedAt: null,
        invoiceNumber: null,
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Test",
        sourceAmount: "100.00",
        sourceCurrencyId: "cur-usd",
        targetCurrencyId: null,
      },
      settlementDestination: {
        bankInstructionSnapshot: null,
        mode: null,
        requisiteId: null,
      },
      type: "payment",
    },
    summary: {
      agreementId: "agreement-1",
      id: "deal-1",
      status: "submitted",
      type: "payment",
    },
  };
}

function compiled(
  overrides: Partial<CompiledDealExecutionOperation> = {},
): CompiledDealExecutionOperation {
  return {
    amountRef: "money_request_source",
    counterAmountRef: null,
    legId: "leg-1",
    legIdx: 1,
    legKind: "collect",
    operationKind: "payin",
    quoteId: null,
    quoteLegIdx: null,
    sourceRef: "deal:deal-1:leg:1:payin:1",
    ...overrides,
  };
}

describe("resolveLegPartyRefs", () => {
  it("resolves collect leg as customer → internal", () => {
    const refs = resolveLegPartyRefs({
      agreementOrganizationId: null,
      compiled: compiled({ legKind: "collect", operationKind: "payin" }),
      internalEntityOrganizationId: "org-1",
      routeAttachment: null,
      workflow: createWorkflow(),
    });

    expect(refs).toEqual({
      fromParty: { id: "customer-1", requisiteId: null },
      toParty: { id: "org-1", requisiteId: null },
    });
  });

  it("resolves payout leg as internal → beneficiary", () => {
    const refs = resolveLegPartyRefs({
      agreementOrganizationId: null,
      compiled: compiled({ legKind: "payout", operationKind: "payout" }),
      internalEntityOrganizationId: "org-1",
      routeAttachment: null,
      workflow: createWorkflow({
        participants: [
          {
            counterpartyId: "beneficiary-1",
            customerId: null,
            displayName: "Beneficiary",
            id: "participant-beneficiary",
            organizationId: null,
            role: "external_beneficiary",
          },
        ],
      }),
    });

    expect(refs).toEqual({
      fromParty: { id: "org-1", requisiteId: null },
      toParty: { id: "beneficiary-1", requisiteId: null },
    });
  });

  it("resolves convert leg as internal → internal", () => {
    const refs = resolveLegPartyRefs({
      agreementOrganizationId: null,
      compiled: compiled({ legKind: "convert", operationKind: "fx_conversion" }),
      internalEntityOrganizationId: "org-1",
      routeAttachment: null,
      workflow: createWorkflow(),
    });

    expect(refs).toEqual({
      fromParty: { id: "org-1", requisiteId: null },
      toParty: { id: "org-1", requisiteId: null },
    });
  });

  it("resolves transit_hold with intercompany_funding as internal → agreement org", () => {
    const refs = resolveLegPartyRefs({
      agreementOrganizationId: "org-2",
      compiled: compiled({
        legKind: "transit_hold",
        operationKind: "intercompany_funding",
      }),
      internalEntityOrganizationId: "org-1",
      routeAttachment: null,
      workflow: createWorkflow(),
    });

    expect(refs).toEqual({
      fromParty: { id: "org-1", requisiteId: null },
      toParty: { id: "org-2", requisiteId: null },
    });
  });

  it("resolves transit_hold with intracompany_transfer as internal → internal", () => {
    const refs = resolveLegPartyRefs({
      agreementOrganizationId: "org-2",
      compiled: compiled({
        legKind: "transit_hold",
        operationKind: "intracompany_transfer",
      }),
      internalEntityOrganizationId: "org-1",
      routeAttachment: null,
      workflow: createWorkflow(),
    });

    expect(refs).toEqual({
      fromParty: { id: "org-1", requisiteId: null },
      toParty: { id: "org-1", requisiteId: null },
    });
  });

  it("returns null when required customer missing for collect leg", () => {
    const refs = resolveLegPartyRefs({
      agreementOrganizationId: null,
      compiled: compiled({ legKind: "collect", operationKind: "payin" }),
      internalEntityOrganizationId: "org-1",
      routeAttachment: null,
      workflow: createWorkflow({ participants: [] }),
    });

    expect(refs).toBeNull();
  });

  it("falls back to external_payer when customer is missing", () => {
    const refs = resolveLegPartyRefs({
      agreementOrganizationId: null,
      compiled: compiled({ legKind: "collect", operationKind: "payin" }),
      internalEntityOrganizationId: "org-1",
      routeAttachment: null,
      workflow: createWorkflow({
        participants: [
          {
            counterpartyId: "payer-1",
            customerId: null,
            displayName: "Payer",
            id: "participant-payer",
            organizationId: null,
            role: "external_payer",
          },
        ],
      }),
    });

    expect(refs).toEqual({
      fromParty: { id: "payer-1", requisiteId: null },
      toParty: { id: "org-1", requisiteId: null },
    });
  });
});

describe("materializeCompiledOperation", () => {
  function createPaymentStepsCommands() {
    return {
      create: vi.fn<(input: Record<string, unknown>) => Promise<unknown>>(
        async () => undefined,
      ),
    };
  }

  function createTreasuryModule(overrides?: {
    paymentStepsCommands?: { create: ReturnType<typeof vi.fn> };
  }) {
    return {
      paymentSteps: {
        commands:
          overrides?.paymentStepsCommands ?? createPaymentStepsCommands(),
      },
      quotes: {} as any,
    };
  }

  function createCurrencies() {
    return {
      findById: vi.fn(async (id: string) => ({
        code: id === "cur-usd" ? "USD" : "EUR",
        id,
      })),
    };
  }

  function createDealStore() {
    return {
      createDealTimelineEvents: vi.fn(async () => undefined),
    };
  }

  it("writes payment step", async () => {
    const paymentStepsCommands = createPaymentStepsCommands();
    const treasuryModule = createTreasuryModule({ paymentStepsCommands });
    const dealStore = createDealStore();

    await materializeCompiledOperation({
      acceptedQuote: null,
      agreementOrganizationId: "org-1",
      compiled: compiled(),
      currencies: createCurrencies() as any,
      currencyCodeById: new Map(),
      customerId: "customer-1",
      dealStore,
      internalEntityOrganizationId: "org-1",
      routeAttachment: null,
      treasuryModule: treasuryModule as any,
      workflow: createWorkflow(),
    });

    expect(paymentStepsCommands.create).toHaveBeenCalledTimes(1);
    expect(paymentStepsCommands.create).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: "deal-1",
        dealLegIdx: 1,
        dealLegRole: "collect",
        fromCurrencyId: "cur-usd",
        fromParty: { id: "customer-1", requisiteId: null },
        kind: "payin",
        purpose: "deal_leg",
        toCurrencyId: "cur-usd",
        toParty: { id: "org-1", requisiteId: null },
      }),
    );
  });

  it("skips payment step creation when party resolution fails", async () => {
    const paymentStepsCommands = createPaymentStepsCommands();
    const treasuryModule = createTreasuryModule({ paymentStepsCommands });
    const workflow = createWorkflow({ participants: [] });

    await materializeCompiledOperation({
      acceptedQuote: null,
      agreementOrganizationId: null,
      compiled: compiled(),
      currencies: createCurrencies() as any,
      currencyCodeById: new Map(),
      customerId: "customer-1",
      dealStore: createDealStore(),
      internalEntityOrganizationId: "org-1",
      routeAttachment: null,
      treasuryModule: treasuryModule as any,
      workflow,
    });

    expect(paymentStepsCommands.create).not.toHaveBeenCalled();
  });

  it("uses from currency as to currency when counter amount ref is absent", async () => {
    const paymentStepsCommands = createPaymentStepsCommands();
    const treasuryModule = createTreasuryModule({ paymentStepsCommands });

    await materializeCompiledOperation({
      acceptedQuote: null,
      agreementOrganizationId: null,
      compiled: compiled({
        amountRef: "money_request_source",
        counterAmountRef: null,
      }),
      currencies: createCurrencies() as any,
      currencyCodeById: new Map(),
      customerId: "customer-1",
      dealStore: createDealStore(),
      internalEntityOrganizationId: "org-1",
      routeAttachment: null,
      treasuryModule: treasuryModule as any,
      workflow: createWorkflow(),
    });

    const call = paymentStepsCommands.create.mock.calls[0]?.[0];
    expect(call?.fromCurrencyId).toBe("cur-usd");
    expect(call?.toCurrencyId).toBe("cur-usd");
    expect(call?.fromAmountMinor).toBe(10000n);
    expect(call?.toAmountMinor).toBe(10000n);
  });
});
