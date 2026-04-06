import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  default: {
    api: {
      userHasPermission,
    },
  },
}));

import { requisitesRoutes } from "../../src/routes/requisites";

function createRequisite() {
  const now = new Date("2026-04-01T00:00:00.000Z");

  return {
    id: "11111111-1111-4111-8111-111111111111",
    ownerType: "organization" as const,
    ownerId: "22222222-2222-4222-8222-222222222222",
    organizationId: "22222222-2222-4222-8222-222222222222",
    counterpartyId: null,
    providerId: "33333333-3333-4333-8333-333333333333",
    providerBranchId: null,
    currencyId: "44444444-4444-4444-8444-444444444444",
    kind: "bank" as const,
    label: "USD settlement",
    beneficiaryName: "Acme LLC",
    beneficiaryNameLocal: null,
    beneficiaryAddress: null,
    paymentPurposeTemplate: null,
    notes: null,
    identifiers: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        requisiteId: "11111111-1111-4111-8111-111111111111",
        scheme: "local_account_number",
        value: "40702810900000000001",
        normalizedValue: "40702810900000000001",
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    isDefault: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createTestApp() {
  const partiesModule = {
    requisites: {
      commands: {
        remove: vi.fn(),
      },
      queries: {
        list: vi.fn().mockResolvedValue({
          data: [],
          limit: 20,
          offset: 0,
          total: 0,
        }),
        listOptions: vi.fn().mockResolvedValue([]),
        findById: vi.fn(),
        findProviderById: vi.fn(),
        getBinding: vi.fn(),
      },
    },
  };
  const requisiteAccountingWorkflow = {
    update: vi.fn(),
    upsertBinding: vi.fn(),
  };
  const currenciesService = {
    findById: vi.fn(),
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role: "admin" } as any);
    await next();
  });

  app.route(
    "/requisites",
    requisitesRoutes({
      currenciesService,
      partiesModule,
      requisiteAccountingWorkflow,
    } as any),
  );

  return { app, requisiteAccountingWorkflow };
}

describe("requisites routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("updates requisite identifiers through the top-level patch route", async () => {
    const { app, requisiteAccountingWorkflow } = createTestApp();
    requisiteAccountingWorkflow.update.mockResolvedValue(createRequisite());

    const response = await app.request(
      "http://localhost/requisites/11111111-1111-4111-8111-111111111111",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: "USD settlement",
          identifiers: [
            {
              scheme: "local_account_number",
              value: "40702810900000000001",
              isPrimary: true,
            },
          ],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(requisiteAccountingWorkflow.update).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      {
        label: "USD settlement",
        identifiers: [
          {
            scheme: "local_account_number",
            value: "40702810900000000001",
            isPrimary: true,
          },
        ],
      },
    );
  });
});
