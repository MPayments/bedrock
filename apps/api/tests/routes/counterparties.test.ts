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

import { counterpartiesRoutes } from "../../src/routes/counterparties";

function createCounterparty(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    customerId: null,
    relationshipKind: "external",
    shortName: "Acme",
    fullName: "Acme LLC",
    description: null,
    country: "US",
    kind: "legal_entity",
    groupIds: [],
    legalEntity: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createTestApp() {
  const counterparties = {
    commands: {
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    queries: {
      findById: vi.fn(),
      list: vi.fn(),
    },
  };
  const legalEntities = {
    commands: {
      replaceBundle: vi.fn(),
    },
  };
  const requisites = {
    commands: {
      create: vi.fn(),
    },
    queries: {
      list: vi.fn().mockResolvedValue({
        data: [],
        limit: 20,
        offset: 0,
        total: 0,
      }),
    },
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role: "admin" } as any);
    await next();
  });

  app.route(
    "/counterparties",
    counterpartiesRoutes({
      partiesModule: {
        counterparties,
        legalEntities,
        requisites,
      },
    } as any),
  );

  return { app, counterparties, legalEntities, requisites };
}

describe("counterparties routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("replaces counterparty legal entity data through the aggregate route", async () => {
    const { app, counterparties, legalEntities } = createTestApp();
    counterparties.queries.findById.mockResolvedValue(createCounterparty());
    legalEntities.commands.replaceBundle.mockResolvedValue({
      profile: {
        id: "22222222-2222-4222-8222-222222222222",
        organizationId: null,
        counterpartyId: "11111111-1111-4111-8111-111111111111",
        fullName: "Acme LLC",
        shortName: "Acme",
        fullNameI18n: null,
        shortNameI18n: null,
        legalFormCode: null,
        legalFormLabel: null,
        legalFormLabelI18n: null,
        countryCode: "US",
        jurisdictionCode: null,
        registrationAuthority: null,
        registeredAt: null,
        businessActivityCode: null,
        businessActivityText: null,
        status: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      identifiers: [],
      addresses: [],
      contacts: [],
      representatives: [],
      licenses: [],
    });

    const response = await app.request(
      "http://localhost/counterparties/11111111-1111-4111-8111-111111111111/legal-entity",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            fullName: "Acme LLC",
            shortName: "Acme",
            countryCode: "us",
          },
          identifiers: [],
          addresses: [],
          contacts: [],
          representatives: [],
          licenses: [],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(legalEntities.commands.replaceBundle).toHaveBeenCalledWith({
      ownerId: "11111111-1111-4111-8111-111111111111",
      ownerType: "counterparty",
      bundle: {
        profile: {
          fullName: "Acme LLC",
          shortName: "Acme",
          fullNameI18n: null,
          shortNameI18n: null,
          legalFormCode: null,
          legalFormLabel: null,
          legalFormLabelI18n: null,
          countryCode: "US",
          jurisdictionCode: null,
          registrationAuthority: null,
          registeredAt: null,
          businessActivityCode: null,
          businessActivityText: null,
          status: null,
        },
        identifiers: [],
        addresses: [],
        contacts: [],
        representatives: [],
        licenses: [],
      },
    });
  });

  it("does not expose the legacy counterparty legal-profile route", async () => {
    const { app } = createTestApp();

    const response = await app.request(
      "http://localhost/counterparties/11111111-1111-4111-8111-111111111111/legal-profile",
    );

    expect(response.status).toBe(404);
  });
});
