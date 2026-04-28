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
        bankInstructionSnapshot: null,
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
      compiled: compiled({
        legKind: "convert",
        operationKind: "quote_execution",
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

  it("resolves payout to a snapshot beneficiary when no beneficiary counterparty exists", () => {
    const workflow = createWorkflow({ participants: [] });
    workflow.intake.externalBeneficiary = {
      bankInstructionSnapshot: {
        accountNo: "123",
        bankAddress: null,
        bankCountry: "AE",
        bankName: "Emirates NBD",
        beneficiaryName: "Almutlag Trading LLC",
        bic: null,
        iban: null,
        label: null,
        swift: "EBILAEAD",
      },
      beneficiaryCounterpartyId: null,
      beneficiarySnapshot: {
        country: "AE",
        displayName: "Almutlag Trading LLC",
        inn: null,
        legalName: "Almutlag Trading LLC",
      },
    };

    const refs = resolveLegPartyRefs({
      agreementOrganizationId: null,
      compiled: compiled({ legKind: "payout", operationKind: "payout" }),
      internalEntityOrganizationId: "org-1",
      routeAttachment: null,
      workflow,
    });

    expect(refs?.fromParty).toEqual({ id: "org-1", requisiteId: null });
    expect(refs?.toParty).toMatchObject({
      displayName: "Almutlag Trading LLC",
      entityKind: "external_beneficiary_snapshot",
      requisiteId: null,
    });
    expect(refs?.toParty.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it("resolves route-derived payout from its route leg participants", () => {
    const workflow = createWorkflow({
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
    });
    workflow.executionPlan = [
      {
        id: "leg-1",
        idx: 1,
        kind: "collect",
        routeSnapshotLegId: "route-leg-1",
        state: "pending",
      },
      {
        id: "leg-2",
        idx: 2,
        kind: "convert",
        routeSnapshotLegId: "route-leg-2",
        state: "pending",
      },
      {
        id: "leg-3",
        idx: 3,
        kind: "payout",
        routeSnapshotLegId: "route-leg-3",
        state: "pending",
      },
    ];

    const refs = resolveLegPartyRefs({
      agreementOrganizationId: null,
      compiled: compiled({
        legId: "leg-3",
        legIdx: 99,
        legKind: "payout",
        operationKind: "payout",
      }),
      internalEntityOrganizationId: "arabian-org",
      routeAttachment: {
        attachedAt: new Date(),
        snapshot: {
          additionalFees: [],
          amountInMinor: "100",
          amountOutMinor: "100",
          currencyInId: "cur-rub",
          currencyOutId: "cur-usd",
          legs: [
            {
              fees: [],
              fromCurrencyId: "cur-rub",
              id: "route-leg-1",
              toCurrencyId: "cur-rub",
            },
            {
              fees: [],
              fromCurrencyId: "cur-rub",
              id: "route-leg-2",
              toCurrencyId: "cur-usd",
            },
            {
              fees: [],
              fromCurrencyId: "cur-usd",
              id: "route-leg-3",
              toCurrencyId: "cur-usd",
            },
          ],
          lockedSide: "currency_out",
          participants: [
            {
              binding: "abstract",
              displayName: "Клиент",
              entityId: null,
              entityKind: null,
              nodeId: "source",
              requisiteId: null,
              role: "source",
            },
            {
              binding: "bound",
              displayName: "ARABIAN FUEL ALLIANCE DMCC",
              entityId: "arabian-org",
              entityKind: "organization",
              nodeId: "arabian",
              requisiteId: "arabian-req",
              role: "hop",
            },
            {
              binding: "bound",
              displayName: "MULTIHANSA BROKERS - FZCO",
              entityId: "multihansa-org",
              entityKind: "organization",
              nodeId: "multihansa",
              requisiteId: "multihansa-req",
              role: "hop",
            },
            {
              binding: "abstract",
              displayName: "Бенефициар",
              entityId: null,
              entityKind: null,
              nodeId: "beneficiary",
              requisiteId: null,
              role: "destination",
            },
          ],
        },
        templateId: "route-template-1",
        templateName: "rub aed usd",
      },
      workflow,
    });

    expect(refs).toEqual({
      fromParty: {
        displayName: "MULTIHANSA BROKERS - FZCO",
        entityKind: "organization",
        id: "multihansa-org",
        requisiteId: "multihansa-req",
      },
      toParty: { id: "beneficiary-1", requisiteId: null },
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
        fromCurrencyId: "cur-usd",
        fromParty: { id: "customer-1", requisiteId: null },
        kind: "payin",
        origin: expect.objectContaining({
          dealId: "deal-1",
          planLegId: "leg-1",
          sequence: 1,
          type: "deal_execution_leg",
        }),
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
