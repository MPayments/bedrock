import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { treasuryOrganizationBalancesRoutes } from "../../src/routes/treasury-organizations-balances";

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

function createTestApp() {
  const listInternalLedgerOrganizations = vi.fn().mockResolvedValue([
    {
      id: "11111111-1111-4111-8111-111111111111",
      shortName: "Multihansa",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      shortName: "Bedrock Treasury",
    },
  ]);
  const listOptions = vi.fn().mockImplementation(
    async ({
      ownerId,
    }: {
      ownerId?: string;
      ownerType?: "organization" | "counterparty";
    }) =>
      ownerId === "11111111-1111-4111-8111-111111111111"
        ? [
            {
              id: "33333333-3333-4333-8333-333333333333",
              ownerType: "organization",
              ownerId,
              providerId: "44444444-4444-4444-8444-444444444444",
              currencyId: "55555555-5555-4555-8555-555555555555",
              kind: "bank" as const,
              label: "USD settlement",
              beneficiaryName: "Multihansa",
              accountNo: "40702810900000000001",
              iban: null,
              network: null,
              assetCode: null,
              address: null,
              memoTag: null,
              accountRef: null,
              subaccountRef: null,
              contact: null,
              notes: null,
              currencyCode: "USD",
            },
          ]
        : [],
  );
  const findById = vi.fn(async (requisiteId: string) =>
    requisiteId === "33333333-3333-4333-8333-333333333333"
      ? {
          id: requisiteId,
          ownerType: "organization",
          ownerId: "11111111-1111-4111-8111-111111111111",
          organizationId: "11111111-1111-4111-8111-111111111111",
          counterpartyId: null,
          providerId: "44444444-4444-4444-8444-444444444444",
          providerBranchId: null,
          currencyId: "55555555-5555-4555-8555-555555555555",
          kind: "bank" as const,
          label: "USD settlement",
          beneficiaryName: "Multihansa",
          beneficiaryNameLocal: null,
          beneficiaryAddress: null,
          paymentPurposeTemplate: null,
          notes: null,
          identifiers: [
            {
              id: `${requisiteId}-account`,
              requisiteId,
              scheme: "local_account_number",
              value: "40702810900000000001",
              normalizedValue: "40702810900000000001",
              isPrimary: true,
              createdAt: new Date("2026-02-01T00:00:00.000Z"),
              updatedAt: new Date("2026-02-01T00:00:00.000Z"),
            },
          ],
          isDefault: true,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
          archivedAt: null,
        }
      : null,
  );
  const ensureDefaultOrganizationBook = vi.fn().mockResolvedValue({
    bookId: "book-1",
  });
  const listOrganizationRequisiteLiquidityRows = vi.fn().mockResolvedValue([
    {
      organizationId: "11111111-1111-4111-8111-111111111111",
      requisiteId: "33333333-3333-4333-8333-333333333333",
      currency: "USD",
      ledgerBalanceMinor: "125000",
      availableMinor: "100000",
      reservedMinor: "20000",
      pendingMinor: "5000",
    },
  ]);
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role: "admin" } as any);
    await next();
  });

  app.route(
    "/treasury/organizations/balances",
    treasuryOrganizationBalancesRoutes({
      ledgerModule: {
        balances: {
          queries: {
            listOrganizationRequisiteLiquidityRows,
          },
        },
        books: {
          commands: {
            ensureDefaultOrganizationBook,
          },
        },
      },
      partiesReadRuntime: {
        organizationsQueries: {
          listInternalLedgerOrganizations,
        },
        requisitesQueries: {
          findById,
          listOptions,
        },
      },
    } as any),
  );

  return {
    app,
    ensureDefaultOrganizationBook,
    findById,
    listInternalLedgerOrganizations,
    listOptions,
    listOrganizationRequisiteLiquidityRows,
  };
}

describe("treasury organization balances route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("returns an enriched current balance snapshot for internal treasury organizations", async () => {
    const {
      app,
      ensureDefaultOrganizationBook,
      findById,
      listInternalLedgerOrganizations,
      listOptions,
      listOrganizationRequisiteLiquidityRows,
    } = createTestApp();

    const response = await app.request(
      "http://localhost/treasury/organizations/balances",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      asOf: expect.any(String),
      data: [
        {
          organizationId: "11111111-1111-4111-8111-111111111111",
          organizationName: "Multihansa",
          requisiteId: "33333333-3333-4333-8333-333333333333",
          requisiteLabel: "USD settlement",
          requisiteIdentity: "40702810900000000001",
          currency: "USD",
          ledgerBalance: "1250",
          available: "1000",
          reserved: "200",
          pending: "50",
        },
      ],
    });

    expect(listInternalLedgerOrganizations).toHaveBeenCalledTimes(1);
    expect(listOrganizationRequisiteLiquidityRows).toHaveBeenCalledWith({
      organizationIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });
    expect(listOptions).toHaveBeenCalledWith({
      ownerId: "11111111-1111-4111-8111-111111111111",
      ownerType: "organization",
    });
    expect(listOptions).toHaveBeenCalledWith({
      ownerId: "22222222-2222-4222-8222-222222222222",
      ownerType: "organization",
    });
    expect(ensureDefaultOrganizationBook).toHaveBeenCalledWith({
      organizationId: "11111111-1111-4111-8111-111111111111",
    });
    expect(findById).toHaveBeenCalledWith(
      "33333333-3333-4333-8333-333333333333",
    );
  });

  it("returns zero-balance rows for organization requisites before the first posting", async () => {
    const {
      app,
      ensureDefaultOrganizationBook,
      listOrganizationRequisiteLiquidityRows,
    } = createTestApp();

    listOrganizationRequisiteLiquidityRows.mockResolvedValueOnce([]);

    const response = await app.request(
      "http://localhost/treasury/organizations/balances",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      asOf: expect.any(String),
      data: [
        {
          organizationId: "11111111-1111-4111-8111-111111111111",
          organizationName: "Multihansa",
          requisiteId: "33333333-3333-4333-8333-333333333333",
          requisiteLabel: "USD settlement",
          requisiteIdentity: "40702810900000000001",
          currency: "USD",
          ledgerBalance: "0",
          available: "0",
          reserved: "0",
          pending: "0",
        },
      ],
    });

    expect(ensureDefaultOrganizationBook).toHaveBeenCalledWith({
      organizationId: "11111111-1111-4111-8111-111111111111",
    });
  });
});
