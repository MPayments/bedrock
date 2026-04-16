import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AgreementRequisiteBindingMissingError,
  AgreementRequisiteOwnershipError,
} from "@bedrock/agreements";

import {
  createCustomerAgreementForCustomer,
  updateCustomerAgreement,
} from "../../src/routes/customer-agreements";

const IDS = {
  agreement: "00000000-0000-4000-8000-000000000501",
  customer: "00000000-0000-4000-8000-000000000502",
  organization: "00000000-0000-4000-8000-000000000503",
  organizationRequisite: "00000000-0000-4000-8000-000000000504",
  user: "00000000-0000-4000-8000-000000000505",
} as const;

function createAgreementDetail() {
  const now = new Date("2026-04-01T00:00:00.000Z");

  return {
    id: IDS.agreement,
    customerId: IDS.customer,
    organizationId: IDS.organization,
    organizationRequisiteId: IDS.organizationRequisite,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    currentVersion: {
      id: "00000000-0000-4000-8000-000000000506",
      versionNumber: 1,
      contractNumber: "AG-2026-001",
      contractDate: now,
      feeRules: [],
      parties: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

function createContext() {
  return {
    agreementsModule: {
      agreements: {
        queries: {
          list: vi.fn(async () => ({
            data: [],
            total: 0,
            limit: 2,
            offset: 0,
          })),
          findById: vi.fn(async () => createAgreementDetail()),
        },
        commands: {
          create: vi.fn(),
          update: vi.fn(),
        },
      },
    },
    currenciesService: {
      findByCode: vi.fn(),
    },
  } as any;
}

describe("customer agreement helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces module-owned create validation errors without API prevalidation", async () => {
    const ctx = createContext();
    const error = new AgreementRequisiteOwnershipError(
      IDS.organizationRequisite,
      IDS.organization,
    );
    ctx.agreementsModule.agreements.commands.create.mockRejectedValue(error);

    await expect(
      createCustomerAgreementForCustomer(
        ctx,
        {
          customerId: IDS.customer,
          organizationId: IDS.organization,
          organizationRequisiteId: IDS.organizationRequisite,
        },
        IDS.user,
        "agreement-create-1",
      ),
    ).rejects.toBe(error);
  });

  it("allows unchanged root ids through and surfaces module-owned update validation errors", async () => {
    const ctx = createContext();
    const current = createAgreementDetail();
    const error = new AgreementRequisiteBindingMissingError(
      IDS.organizationRequisite,
    );
    ctx.agreementsModule.agreements.queries.findById.mockResolvedValue(current);
    ctx.agreementsModule.agreements.commands.update.mockRejectedValue(error);

    await expect(
      updateCustomerAgreement(
        ctx,
        {
          organizationId: current.organizationId,
          organizationRequisiteId: current.organizationRequisiteId,
        },
        current.id,
        IDS.user,
        "agreement-update-1",
      ),
    ).rejects.toBe(error);
  });

  it("generates a unique default contract number when create omits it", async () => {
    const ctx = createContext();
    ctx.agreementsModule.agreements.commands.create.mockResolvedValue(
      createAgreementDetail(),
    );

    await createCustomerAgreementForCustomer(
      ctx,
      {
        customerId: IDS.customer,
        organizationId: IDS.organization,
        organizationRequisiteId: IDS.organizationRequisite,
        contractNumber: null,
      },
      IDS.user,
      "agreement-create-default-1",
    );

    const call =
      ctx.agreementsModule.agreements.commands.create.mock.calls[0][0];
    expect(call.contractNumber).toMatch(
      /^contract#[0-9A-F]{8}-[0-9A-F]{8}$/,
    );
    expect(call.contractNumber).toContain(
      IDS.customer.slice(0, 8).toUpperCase(),
    );
  });

  it("produces a distinct default contract number on each create", async () => {
    const ctx = createContext();
    ctx.agreementsModule.agreements.commands.create.mockResolvedValue(
      createAgreementDetail(),
    );

    await createCustomerAgreementForCustomer(
      ctx,
      {
        customerId: IDS.customer,
        organizationId: IDS.organization,
        organizationRequisiteId: IDS.organizationRequisite,
      },
      IDS.user,
      "agreement-create-default-2",
    );
    await createCustomerAgreementForCustomer(
      ctx,
      {
        customerId: IDS.customer,
        organizationId: IDS.organization,
        organizationRequisiteId: IDS.organizationRequisite,
      },
      IDS.user,
      "agreement-create-default-3",
    );

    const [firstCall, secondCall] =
      ctx.agreementsModule.agreements.commands.create.mock.calls;
    expect(firstCall[0].contractNumber).not.toBe(secondCall[0].contractNumber);
  });

  it("clears contract number on update when null is provided", async () => {
    const ctx = createContext();
    const current = createAgreementDetail();
    ctx.agreementsModule.agreements.queries.findById.mockResolvedValue(current);
    ctx.agreementsModule.agreements.commands.update.mockResolvedValue(current);

    await updateCustomerAgreement(
      ctx,
      { contractNumber: null },
      current.id,
      IDS.user,
      "agreement-update-clear",
    );

    const call =
      ctx.agreementsModule.agreements.commands.update.mock.calls[0][0];
    expect(call.contractNumber).toBeNull();
  });

  it("clears contract number on update when an empty string is provided", async () => {
    const ctx = createContext();
    const current = createAgreementDetail();
    ctx.agreementsModule.agreements.queries.findById.mockResolvedValue(current);
    ctx.agreementsModule.agreements.commands.update.mockResolvedValue(current);

    await updateCustomerAgreement(
      ctx,
      { contractNumber: "   " },
      current.id,
      IDS.user,
      "agreement-update-clear-blank",
    );

    const call =
      ctx.agreementsModule.agreements.commands.update.mock.calls[0][0];
    expect(call.contractNumber).toBeNull();
  });

  it("leaves contract number unchanged on update when field is omitted", async () => {
    const ctx = createContext();
    const current = createAgreementDetail();
    ctx.agreementsModule.agreements.queries.findById.mockResolvedValue(current);
    ctx.agreementsModule.agreements.commands.update.mockResolvedValue(current);

    await updateCustomerAgreement(
      ctx,
      {},
      current.id,
      IDS.user,
      "agreement-update-untouched",
    );

    const call =
      ctx.agreementsModule.agreements.commands.update.mock.calls[0][0];
    expect(call.contractNumber).toBeUndefined();
  });
});
