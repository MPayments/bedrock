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
      routePolicies: [],
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
          resolveRouteDefaults: vi.fn(),
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
});
