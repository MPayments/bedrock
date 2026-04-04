import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import { CreateDealCommand } from "../../src/application/commands/create-deal";
import {
  DealAgreementCustomerMismatchError,
  DealAgreementInactiveError,
  DealTypeNotSupportedError,
} from "../../src/errors";

function createLogger() {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

function createHarness() {
  const dealReads = {
    findById: vi.fn(),
    findWorkflowById: vi.fn(),
    list: vi.fn(),
  };
  const dealStore = {
    createDealApprovals: vi.fn(),
    createDealCalculationLinks: vi.fn(),
    createDealIntakeSnapshot: vi.fn(),
    createDealRoot: vi.fn(),
    createDealTimelineEvents: vi.fn(),
    createDealQuoteAcceptance: vi.fn(),
    replaceDealLegs: vi.fn(),
    replaceDealOperationalPositions: vi.fn(),
    replaceDealParticipants: vi.fn(),
    replaceIntakeSnapshot: vi.fn(),
    setDealRoot: vi.fn(),
    supersedeCurrentQuoteAcceptances: vi.fn(),
  };
  const tx = {
    transaction: { id: "tx-1" } as any,
    dealReads,
    dealStore,
  };
  const commandUow = {
    run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const idempotency = {
    withIdempotencyTx: vi.fn(async ({ handler }) => handler()),
  };
  const references = {
    findAgreementById: vi.fn(async () => ({
      currentVersionId: "version-1",
      customerId: "00000000-0000-4000-8000-000000000001",
      id: "agreement-1",
      isActive: true,
      organizationId: "00000000-0000-4000-8000-000000000002",
    })),
    findCalculationById: vi.fn(),
    findCounterpartyById: vi.fn(async () => ({ id: "counterparty-1" })),
    findCurrencyById: vi.fn(async () => ({
      code: "USD",
      id: "00000000-0000-4000-8000-000000000005",
      precision: 2,
    })),
    findCustomerById: vi.fn(async () => ({ id: "customer-1" })),
    findQuoteById: vi.fn(),
    listActiveAgreementsByCustomerId: vi.fn(async () => []),
    validateSupportedCreateType: vi.fn(),
  };
  const uuids = [
    "00000000-0000-4000-8000-000000000010",
    "00000000-0000-4000-8000-000000000011",
    "00000000-0000-4000-8000-000000000012",
    "00000000-0000-4000-8000-000000000013",
    "00000000-0000-4000-8000-000000000014",
    "00000000-0000-4000-8000-000000000015",
    "00000000-0000-4000-8000-000000000016",
  ];
  const runtime = createModuleRuntime({
    generateUuid: () =>
      uuids.shift() ?? "00000000-0000-4000-8000-000000000099",
    logger: createLogger(),
    now: () => new Date("2026-03-30T12:00:00.000Z"),
    service: "deals",
  });
  const command = new CreateDealCommand(
    runtime,
    commandUow as any,
    idempotency as any,
    references as any,
  );

  return {
    commandUow,
    dealReads,
    dealStore,
    handler: command.execute.bind(command),
    idempotency,
    references,
  };
}

describe("create deal command", () => {
  it("creates a compatibility draft via typed intake snapshot, participants, and timeline", async () => {
    const harness = createHarness();
    const expected = {
      agreementId: "agreement-1",
      approvals: [],
      calculationId: null,
      comment: "Deal comment",
      createdAt: new Date("2026-03-30T12:00:00.000Z"),
      customerId: "00000000-0000-4000-8000-000000000001",
      id: "00000000-0000-4000-8000-000000000010",
      intakeComment: "Deal comment",
      legs: [],
      nextAction: "Complete intake",
      participants: [],
      reason: null,
      requestedAmount: "100.50",
      requestedCurrencyId: "00000000-0000-4000-8000-000000000005",
      revision: 1,
      status: "draft",
      statusHistory: [],
      type: "payment",
      updatedAt: new Date("2026-03-30T12:00:00.000Z"),
    };

    harness.dealReads.findWorkflowById.mockResolvedValue({
      operationalState: {
        capabilities: [],
        positions: [],
      },
      nextAction: "Complete intake",
      summary: { id: "00000000-0000-4000-8000-000000000010" },
    });
    harness.dealReads.findById.mockResolvedValue(expected);

    const result = await harness.handler({
      actorUserId: "user-1",
      agreementId: "00000000-0000-4000-8000-000000000002",
      comment: "  Deal comment  ",
      counterpartyId: "00000000-0000-4000-8000-000000000004",
      customerId: "00000000-0000-4000-8000-000000000001",
      idempotencyKey: "deal-create-1",
      requestedAmount: "100.50",
      requestedCurrencyId: "00000000-0000-4000-8000-000000000005",
      type: "payment",
    });

    expect(result).toBe(expected);
    expect(harness.commandUow.run).toHaveBeenCalledTimes(2);
    expect(harness.idempotency.withIdempotencyTx).toHaveBeenCalledTimes(1);
    expect(harness.dealStore.createDealRoot).toHaveBeenCalledWith({
      agreementId: "agreement-1",
      agentId: null,
      calculationId: null,
      customerId: "00000000-0000-4000-8000-000000000001",
      id: "00000000-0000-4000-8000-000000000010",
      nextAction: "Complete intake",
      sourceAmountMinor: null,
      sourceCurrencyId: null,
      status: "draft",
      targetCurrencyId: "00000000-0000-4000-8000-000000000005",
      type: "payment",
    });
    expect(harness.dealStore.createDealIntakeSnapshot).toHaveBeenCalledWith({
      dealId: "00000000-0000-4000-8000-000000000010",
      revision: 1,
      snapshot: {
        common: {
          applicantCounterpartyId: "00000000-0000-4000-8000-000000000004",
          customerNote: "Deal comment",
          requestedExecutionDate: null,
        },
        externalBeneficiary: {
          bankInstructionSnapshot: null,
          beneficiaryCounterpartyId: null,
          beneficiarySnapshot: null,
        },
        incomingReceipt: {
          contractNumber: null,
          expectedAmount: "100.50",
          expectedAt: null,
          expectedCurrencyId: "00000000-0000-4000-8000-000000000005",
          invoiceNumber: null,
          payerCounterpartyId: null,
          payerSnapshot: null,
        },
        moneyRequest: {
          purpose: null,
          sourceAmount: null,
          sourceCurrencyId: null,
          targetCurrencyId: "00000000-0000-4000-8000-000000000005",
        },
        settlementDestination: {
          bankInstructionSnapshot: null,
          mode: null,
          requisiteId: null,
        },
        type: "payment",
      },
    });
    expect(harness.dealStore.replaceDealLegs).toHaveBeenCalledWith({
      dealId: "00000000-0000-4000-8000-000000000010",
      legs: [
        {
          dealId: "00000000-0000-4000-8000-000000000010",
          id: "00000000-0000-4000-8000-000000000011",
          idx: 1,
          kind: "collect",
          state: "pending",
        },
        {
          dealId: "00000000-0000-4000-8000-000000000010",
          id: "00000000-0000-4000-8000-000000000012",
          idx: 2,
          kind: "payout",
          state: "pending",
        },
      ],
    });
    expect(harness.dealStore.replaceDealParticipants).toHaveBeenCalledWith({
      dealId: "00000000-0000-4000-8000-000000000010",
      participants: [
        {
          counterpartyId: null,
          customerId: "00000000-0000-4000-8000-000000000001",
          dealId: "00000000-0000-4000-8000-000000000010",
          id: "00000000-0000-4000-8000-000000000013",
          organizationId: null,
          role: "customer",
        },
        {
          counterpartyId: null,
          customerId: null,
          dealId: "00000000-0000-4000-8000-000000000010",
          id: "00000000-0000-4000-8000-000000000014",
          organizationId: "00000000-0000-4000-8000-000000000002",
          role: "internal_entity",
        },
        {
          counterpartyId: "00000000-0000-4000-8000-000000000004",
          customerId: null,
          dealId: "00000000-0000-4000-8000-000000000010",
          id: "00000000-0000-4000-8000-000000000015",
          organizationId: null,
          role: "applicant",
        },
      ],
    });
    expect(harness.dealStore.createDealTimelineEvents).toHaveBeenCalledWith([
      {
        actorLabel: null,
        actorUserId: "user-1",
        dealId: "00000000-0000-4000-8000-000000000010",
        id: "00000000-0000-4000-8000-000000000016",
        occurredAt: new Date("2026-03-30T12:00:00.000Z"),
        payload: {
          intakeType: "payment",
          status: "draft",
        },
        sourceRef: null,
        type: "deal_created",
        visibility: "customer_safe",
      },
    ]);
  });

  it("rejects inactive agreements", async () => {
    const harness = createHarness();
    harness.references.findAgreementById.mockResolvedValue({
      currentVersionId: "version-1",
      customerId: "00000000-0000-4000-8000-000000000001",
      id: "agreement-1",
      isActive: false,
      organizationId: "00000000-0000-4000-8000-000000000002",
    });

    await expect(
      harness.handler({
        actorUserId: "user-1",
        agreementId: "00000000-0000-4000-8000-000000000002",
        comment: null,
        customerId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "deal-create-2",
        type: "payment",
      }),
    ).rejects.toBeInstanceOf(DealAgreementInactiveError);
  });

  it("rejects agreement ownership mismatches", async () => {
    const harness = createHarness();
    harness.references.findAgreementById.mockResolvedValue({
      currentVersionId: "version-1",
      customerId: "different-customer",
      id: "agreement-1",
      isActive: true,
      organizationId: "00000000-0000-4000-8000-000000000002",
    });

    await expect(
      harness.handler({
        actorUserId: "user-1",
        agreementId: "00000000-0000-4000-8000-000000000002",
        comment: null,
        customerId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "deal-create-3",
        type: "payment",
      }),
    ).rejects.toBeInstanceOf(DealAgreementCustomerMismatchError);
  });

  it("rejects unsupported create types when the reference policy denies them", async () => {
    const harness = createHarness();
    harness.references.validateSupportedCreateType.mockImplementation(
      (type: string) => {
        if (type !== "payment") {
          throw new DealTypeNotSupportedError(type);
        }
      },
    );

    await expect(
      harness.handler({
        actorUserId: "user-1",
        agreementId: "00000000-0000-4000-8000-000000000002",
        comment: null,
        customerId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "deal-create-4",
        type: "currency_exchange",
      }),
    ).rejects.toBeInstanceOf(DealTypeNotSupportedError);
  });
});
