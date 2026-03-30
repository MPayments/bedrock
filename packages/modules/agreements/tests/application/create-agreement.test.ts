import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import {
  AgreementRequisiteBindingMissingError,
  AgreementRequisiteOwnershipError,
} from "../../src/errors";
import { CreateAgreementCommand } from "../../src/application/commands/create-agreement";

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

function createHandlerHarness() {
  const agreementReads = {
    findById: vi.fn(),
  };
  const agreementStore = {
    createAgreementRoot: vi.fn(),
    createAgreementVersion: vi.fn(),
    createAgreementParties: vi.fn(),
    createAgreementFeeRules: vi.fn(),
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
    findCustomerById: vi.fn(async () => ({ id: "customer-1" })),
    findOrganizationById: vi.fn(async () => ({ id: "organization-1" })),
    findRequisiteSubjectById: vi.fn(async () => ({
      id: "requisite-1",
      ownerType: "organization" as const,
      organizationId: "00000000-0000-4000-8000-000000000002",
    })),
    findOrganizationRequisiteBindingByRequisiteId: vi.fn(async () => ({
      requisiteId: "requisite-1",
    })),
    assertCurrencyExists: vi.fn(async () => undefined),
  };
  const uuids = [
    "00000000-0000-4000-8000-000000000010",
    "00000000-0000-4000-8000-000000000011",
    "00000000-0000-4000-8000-000000000012",
    "00000000-0000-4000-8000-000000000013",
    "00000000-0000-4000-8000-000000000014",
  ];
  const runtime = createModuleRuntime({
    service: "agreements",
    logger: createLogger(),
    generateUuid: () => uuids.shift() ?? "00000000-0000-4000-8000-000000000099",
    now: () => new Date("2026-03-30T12:00:00.000Z"),
  });

  const command = new CreateAgreementCommand(
    runtime,
    commandUow as any,
    idempotency as any,
    references,
  );

  return {
    agreementReads,
    agreementStore,
    commandUow,
    handler: command.execute.bind(command),
    idempotency,
    references,
  };
}

describe("create agreement handler", () => {
  it("creates the root, version, parties, fee rules, and current version in one flow", async () => {
    const harness = createHandlerHarness();
    const expectedAgreement = {
      id: "00000000-0000-4000-8000-000000000010",
      customerId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000003",
      isActive: true,
      currentVersion: {
        id: "00000000-0000-4000-8000-000000000011",
        versionNumber: 1,
        contractNumber: "AG-12",
        contractDate: new Date("2026-03-30"),
        feeRules: [],
        parties: [],
        createdAt: new Date("2026-03-30T12:00:00.000Z"),
        updatedAt: new Date("2026-03-30T12:00:00.000Z"),
      },
      createdAt: new Date("2026-03-30T12:00:00.000Z"),
      updatedAt: new Date("2026-03-30T12:00:00.000Z"),
    };
    harness.agreementReads.findById.mockResolvedValue(expectedAgreement);

    const result = await harness.handler({
      actorUserId: "user-1",
      idempotencyKey: "idem-1",
      customerId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000003",
      contractNumber: " AG-12 ",
      contractDate: "2026-03-30",
      feeRules: [
        {
          kind: "fixed_fee",
          unit: "money",
          value: "1000.50",
          currencyId: "00000000-0000-4000-8000-000000000004",
        },
      ],
    });

    expect(result).toBe(expectedAgreement);
    expect(harness.commandUow.run).toHaveBeenCalledTimes(1);
    expect(harness.idempotency.withIdempotencyTx).toHaveBeenCalledTimes(1);
    expect(harness.references.assertCurrencyExists).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000004",
    );
    expect(harness.agreementStore.createAgreementRoot).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000010",
      customerId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000003",
    });
    expect(harness.agreementStore.createAgreementVersion).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000011",
      agreementId: "00000000-0000-4000-8000-000000000010",
      versionNumber: 1,
      contractNumber: "AG-12",
      contractDate: new Date("2026-03-30"),
    });
    expect(harness.agreementStore.createAgreementParties).toHaveBeenCalledWith([
      {
        id: "00000000-0000-4000-8000-000000000012",
        agreementVersionId: "00000000-0000-4000-8000-000000000011",
        partyRole: "customer",
        customerId: "00000000-0000-4000-8000-000000000001",
        organizationId: null,
      },
      {
        id: "00000000-0000-4000-8000-000000000013",
        agreementVersionId: "00000000-0000-4000-8000-000000000011",
        partyRole: "organization",
        customerId: null,
        organizationId: "00000000-0000-4000-8000-000000000002",
      },
    ]);
    expect(harness.agreementStore.createAgreementFeeRules).toHaveBeenCalledWith([
      {
        id: "00000000-0000-4000-8000-000000000014",
        agreementVersionId: "00000000-0000-4000-8000-000000000011",
        kind: "fixed_fee",
        unit: "money",
        valueNumeric: "1000.50",
        currencyId: "00000000-0000-4000-8000-000000000004",
      },
    ]);
    expect(harness.agreementStore.setCurrentVersion).toHaveBeenCalledWith({
      agreementId: "00000000-0000-4000-8000-000000000010",
      currentVersionId: "00000000-0000-4000-8000-000000000011",
    });
  });

  it("rejects requisites owned by a different organization", async () => {
    const harness = createHandlerHarness();
    harness.references.findRequisiteSubjectById.mockResolvedValue({
      id: "requisite-1",
      ownerType: "organization",
      organizationId: "other-organization",
    });

    await expect(
      harness.handler({
        actorUserId: "user-1",
        idempotencyKey: "idem-2",
        customerId: "00000000-0000-4000-8000-000000000001",
        organizationId: "00000000-0000-4000-8000-000000000002",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000003",
        feeRules: [],
      }),
    ).rejects.toBeInstanceOf(AgreementRequisiteOwnershipError);
  });

  it("rejects requisites without an organization binding", async () => {
    const harness = createHandlerHarness();
    harness.references.findOrganizationRequisiteBindingByRequisiteId.mockResolvedValue(
      null,
    );

    await expect(
      harness.handler({
        actorUserId: "user-1",
        idempotencyKey: "idem-3",
        customerId: "00000000-0000-4000-8000-000000000001",
        organizationId: "00000000-0000-4000-8000-000000000002",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000003",
        feeRules: [],
      }),
    ).rejects.toBeInstanceOf(AgreementRequisiteBindingMissingError);
  });
});
