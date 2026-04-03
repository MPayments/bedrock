import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import { UpdateAgreementCommand } from "../../src/application/commands/update-agreement";

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

function createAgreementDetails() {
  const now = new Date("2026-03-30T12:00:00.000Z");

  return {
    id: "00000000-0000-4000-8000-000000000010",
    customerId: "00000000-0000-4000-8000-000000000001",
    organizationId: "00000000-0000-4000-8000-000000000002",
    organizationRequisiteId: "00000000-0000-4000-8000-000000000003",
    isActive: true,
    currentVersion: {
      id: "00000000-0000-4000-8000-000000000011",
      versionNumber: 1,
      contractNumber: "AG-001",
      contractDate: new Date("2026-03-30T00:00:00.000Z"),
      feeRules: [
        {
          id: "00000000-0000-4000-8000-000000000012",
          kind: "agent_fee" as const,
          unit: "bps" as const,
          value: "125",
          currencyId: null,
          currencyCode: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      parties: [],
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createHarness() {
  const agreementReads = {
    findById: vi.fn(),
  };
  const agreementStore = {
    createAgreementFeeRules: vi.fn(),
    createAgreementParties: vi.fn(),
    createAgreementVersion: vi.fn(),
    setCurrentVersion: vi.fn(),
  };
  const tx = {
    transaction: { id: "tx-1" } as any,
    agreementReads,
    agreementStore,
  };
  const commandUow = {
    run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const idempotency = {
    withIdempotencyTx: vi.fn(async ({ handler }) => handler()),
  };
  const references = {
    assertCurrencyExists: vi.fn(async () => undefined),
    findCustomerById: vi.fn(),
    findOrganizationById: vi.fn(),
    findOrganizationRequisiteBindingByRequisiteId: vi.fn(),
    findRequisiteSubjectById: vi.fn(),
  };
  const uuids = [
    "00000000-0000-4000-8000-000000000020",
    "00000000-0000-4000-8000-000000000021",
    "00000000-0000-4000-8000-000000000022",
  ];
  const runtime = createModuleRuntime({
    service: "agreements",
    logger: createLogger(),
    generateUuid: () => uuids.shift() ?? "00000000-0000-4000-8000-000000000099",
    now: () => new Date("2026-03-30T12:00:00.000Z"),
  });

  const command = new UpdateAgreementCommand(
    runtime,
    commandUow as any,
    idempotency as any,
    references as any,
  );

  return {
    agreementReads,
    agreementStore,
    handler: command.execute.bind(command),
    idempotency,
  };
}

describe("update agreement handler", () => {
  it("creates a new version and advances the current version", async () => {
    const harness = createHarness();
    const current = createAgreementDetails();
    const updated = {
      ...current,
      updatedAt: new Date("2026-03-31T12:00:00.000Z"),
      currentVersion: {
        ...current.currentVersion,
        id: "00000000-0000-4000-8000-000000000020",
        versionNumber: 2,
        contractNumber: "AG-002",
      },
    };
    harness.agreementReads.findById
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(updated);

    const result = await harness.handler({
      actorUserId: "user-1",
      id: current.id,
      idempotencyKey: "idem-update-1",
      contractNumber: "AG-002",
    });

    expect(result).toBe(updated);
    expect(harness.idempotency.withIdempotencyTx).toHaveBeenCalledTimes(1);
    expect(harness.agreementStore.createAgreementVersion).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000020",
      agreementId: current.id,
      versionNumber: 2,
      contractNumber: "AG-002",
      contractDate: current.currentVersion.contractDate,
    });
    expect(harness.agreementStore.createAgreementParties).toHaveBeenCalledWith([
      {
        id: "00000000-0000-4000-8000-000000000021",
        agreementVersionId: "00000000-0000-4000-8000-000000000020",
        partyRole: "customer",
        customerId: current.customerId,
        organizationId: null,
      },
      {
        id: "00000000-0000-4000-8000-000000000022",
        agreementVersionId: "00000000-0000-4000-8000-000000000020",
        partyRole: "organization",
        customerId: null,
        organizationId: current.organizationId,
      },
    ]);
    expect(harness.agreementStore.createAgreementFeeRules).toHaveBeenCalledWith([
      {
        id: "00000000-0000-4000-8000-000000000099",
        agreementVersionId: "00000000-0000-4000-8000-000000000020",
        kind: "agent_fee",
        unit: "bps",
        valueNumeric: "125",
        currencyId: null,
      },
    ]);
    expect(harness.agreementStore.setCurrentVersion).toHaveBeenCalledWith({
      agreementId: current.id,
      currentVersionId: "00000000-0000-4000-8000-000000000020",
    });
  });
});
