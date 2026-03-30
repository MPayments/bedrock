import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import {
  DealAgreementCustomerMismatchError,
  DealAgreementInactiveError,
  DealCalculationInactiveError,
  DealTypeNotSupportedError,
} from "../../src/errors";
import { CreateDealCommand } from "../../src/application/commands/create-deal";

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
    list: vi.fn(),
  };
  const dealStore = {
    createDealRoot: vi.fn(),
    createDealLegs: vi.fn(),
    createDealParticipants: vi.fn(),
    createDealStatusHistory: vi.fn(),
    createDealApprovals: vi.fn(),
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
      id: "agreement-1",
      customerId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      isActive: true,
    })),
    findCalculationById: vi.fn(async () => ({
      id: "calculation-1",
      isActive: true,
    })),
    findCounterpartyById: vi.fn(async () => ({ id: "counterparty-1" })),
    findCustomerById: vi.fn(async () => ({ id: "customer-1" })),
    validateSupportedCreateType: vi.fn((type: string) => {
      if (type !== "payment") {
        throw new DealTypeNotSupportedError(type);
      }
    }),
  };
  const uuids = [
    "00000000-0000-4000-8000-000000000010",
    "00000000-0000-4000-8000-000000000011",
    "00000000-0000-4000-8000-000000000012",
    "00000000-0000-4000-8000-000000000013",
    "00000000-0000-4000-8000-000000000014",
  ];
  const runtime = createModuleRuntime({
    service: "deals",
    logger: createLogger(),
    generateUuid: () => uuids.shift() ?? "00000000-0000-4000-8000-000000000099",
    now: () => new Date("2026-03-30T12:00:00.000Z"),
  });
  const command = new CreateDealCommand(
    runtime,
    commandUow as any,
    idempotency as any,
    references,
  );

  return {
    dealReads,
    dealStore,
    commandUow,
    idempotency,
    references,
    handler: command.execute.bind(command),
  };
}

describe("create deal command", () => {
  it("creates a draft deal with a default payment leg, participants, and status history", async () => {
    const harness = createHarness();
    const expected = {
      id: "00000000-0000-4000-8000-000000000010",
      customerId: "00000000-0000-4000-8000-000000000001",
      agreementId: "00000000-0000-4000-8000-000000000002",
      calculationId: "00000000-0000-4000-8000-000000000003",
      type: "payment",
      status: "draft",
      comment: "Deal comment",
      createdAt: new Date("2026-03-30T12:00:00.000Z"),
      updatedAt: new Date("2026-03-30T12:00:00.000Z"),
      legs: [],
      participants: [],
      statusHistory: [],
      approvals: [],
    };
    harness.dealReads.findById.mockResolvedValue(expected);

    const result = await harness.handler({
      actorUserId: "user-1",
      idempotencyKey: "deal-create-1",
      customerId: "00000000-0000-4000-8000-000000000001",
      agreementId: "00000000-0000-4000-8000-000000000002",
      calculationId: "00000000-0000-4000-8000-000000000003",
      type: "payment",
      counterpartyId: "00000000-0000-4000-8000-000000000004",
      comment: "  Deal comment  ",
    });

    expect(result).toBe(expected);
    expect(harness.commandUow.run).toHaveBeenCalledTimes(1);
    expect(harness.idempotency.withIdempotencyTx).toHaveBeenCalledTimes(1);
    expect(harness.dealStore.createDealRoot).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000010",
      customerId: "00000000-0000-4000-8000-000000000001",
      agreementId: "00000000-0000-4000-8000-000000000002",
      calculationId: "00000000-0000-4000-8000-000000000003",
      type: "payment",
      comment: "Deal comment",
    });
    expect(harness.dealStore.createDealLegs).toHaveBeenCalledWith([
      {
        id: "00000000-0000-4000-8000-000000000011",
        dealId: "00000000-0000-4000-8000-000000000010",
        idx: 1,
        kind: "payment",
        status: "draft",
      },
    ]);
    expect(harness.dealStore.createDealParticipants).toHaveBeenCalledWith([
      {
        id: "00000000-0000-4000-8000-000000000012",
        dealId: "00000000-0000-4000-8000-000000000010",
        role: "customer",
        customerId: "00000000-0000-4000-8000-000000000001",
        organizationId: null,
        counterpartyId: null,
      },
      {
        id: "00000000-0000-4000-8000-000000000013",
        dealId: "00000000-0000-4000-8000-000000000010",
        role: "organization",
        customerId: null,
        organizationId: "00000000-0000-4000-8000-000000000002",
        counterpartyId: null,
      },
      {
        id: "00000000-0000-4000-8000-000000000014",
        dealId: "00000000-0000-4000-8000-000000000010",
        role: "counterparty",
        customerId: null,
        organizationId: null,
        counterpartyId: "00000000-0000-4000-8000-000000000004",
      },
    ]);
    expect(harness.dealStore.createDealStatusHistory).toHaveBeenCalledWith([
      {
        id: "00000000-0000-4000-8000-000000000099",
        dealId: "00000000-0000-4000-8000-000000000010",
        status: "draft",
        changedBy: "user-1",
        comment: "Deal comment",
      },
    ]);
  });

  it("rejects inactive agreements", async () => {
    const harness = createHarness();
    harness.references.findAgreementById.mockResolvedValue({
      id: "agreement-1",
      customerId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      isActive: false,
    });

    await expect(
      harness.handler({
        actorUserId: "user-1",
        idempotencyKey: "deal-create-2",
        customerId: "00000000-0000-4000-8000-000000000001",
        agreementId: "00000000-0000-4000-8000-000000000002",
        calculationId: "00000000-0000-4000-8000-000000000003",
        type: "payment",
        comment: null,
      }),
    ).rejects.toBeInstanceOf(DealAgreementInactiveError);
  });

  it("rejects agreement ownership mismatches", async () => {
    const harness = createHarness();
    harness.references.findAgreementById.mockResolvedValue({
      id: "agreement-1",
      customerId: "different-customer",
      organizationId: "00000000-0000-4000-8000-000000000002",
      isActive: true,
    });

    await expect(
      harness.handler({
        actorUserId: "user-1",
        idempotencyKey: "deal-create-3",
        customerId: "00000000-0000-4000-8000-000000000001",
        agreementId: "00000000-0000-4000-8000-000000000002",
        calculationId: "00000000-0000-4000-8000-000000000003",
        type: "payment",
        comment: null,
      }),
    ).rejects.toBeInstanceOf(DealAgreementCustomerMismatchError);
  });

  it("rejects inactive calculations", async () => {
    const harness = createHarness();
    harness.references.findCalculationById.mockResolvedValue({
      id: "calculation-1",
      isActive: false,
    });

    await expect(
      harness.handler({
        actorUserId: "user-1",
        idempotencyKey: "deal-create-4",
        customerId: "00000000-0000-4000-8000-000000000001",
        agreementId: "00000000-0000-4000-8000-000000000002",
        calculationId: "00000000-0000-4000-8000-000000000003",
        type: "payment",
        comment: null,
      }),
    ).rejects.toBeInstanceOf(DealCalculationInactiveError);
  });

  it("rejects non-payment create types in phase 16", async () => {
    const harness = createHarness();

    await expect(
      harness.handler({
        actorUserId: "user-1",
        idempotencyKey: "deal-create-5",
        customerId: "00000000-0000-4000-8000-000000000001",
        agreementId: "00000000-0000-4000-8000-000000000002",
        calculationId: "00000000-0000-4000-8000-000000000003",
        type: "currency_exchange",
        comment: null,
      }),
    ).rejects.toBeInstanceOf(DealTypeNotSupportedError);
  });
});
