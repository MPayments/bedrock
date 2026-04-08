import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CounterpartyNotFoundError,
  SubAgentProfileNotFoundError,
} from "@bedrock/parties";

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
import { counterpartyDirectoryRoutes } from "../../src/routes/counterparty-directory";

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
    partyProfile: null,
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
  const partyProfiles = {
    commands: {
      replaceBundle: vi.fn(),
    },
  };
  const subAgentProfiles = {
    queries: {
      findById: vi.fn(),
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
  const counterpartiesQueries = {
    listAssignmentsByCounterpartyIds: vi.fn().mockResolvedValue(new Map()),
    searchCustomerOwnedCounterparties: vi.fn().mockResolvedValue([]),
    upsertAssignment: vi.fn(),
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
        partyProfiles,
        requisites,
        subAgentProfiles,
      },
      partiesReadRuntime: {
        counterpartiesQueries,
      },
    } as any),
  );

  return {
    app,
    counterparties,
    counterpartiesQueries,
    partyProfiles,
    requisites,
    subAgentProfiles,
  };
}

describe("counterparties routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("replaces counterparty legal entity data through the aggregate route", async () => {
    const { app, counterparties, partyProfiles } = createTestApp();
    counterparties.queries.findById.mockResolvedValue(createCounterparty());
    partyProfiles.commands.replaceBundle.mockResolvedValue({
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
        businessActivityCode: null,
        businessActivityText: null,
        businessActivityTextI18n: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      identifiers: [],
      address: null,
      contacts: [],
      representatives: [],
      licenses: [],
    });

    const response = await app.request(
      "http://localhost/counterparties/11111111-1111-4111-8111-111111111111/party-profile",
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
          address: null,
          contacts: [],
          representatives: [],
          licenses: [],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(partyProfiles.commands.replaceBundle).toHaveBeenCalledWith({
      ownerId: "11111111-1111-4111-8111-111111111111",
      ownerType: "counterparty",
      partyKind: "legal_entity",
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
          businessActivityCode: null,
          businessActivityText: null,
          businessActivityTextI18n: null,
        },
        identifiers: [],
        address: null,
        contacts: [],
        representatives: [],
        licenses: [],
      },
    });
  });

  it("returns 404 for nested routes when the counterparty does not exist", async () => {
    const { app, counterparties, partyProfiles } = createTestApp();
    counterparties.queries.findById.mockResolvedValue(null);

    const requisitesResponse = await app.request(
      "http://localhost/counterparties/11111111-1111-4111-8111-111111111111/requisites",
    );
    const profileResponse = await app.request(
      "http://localhost/counterparties/11111111-1111-4111-8111-111111111111/party-profile",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            fullName: "Acme LLC",
            shortName: "Acme",
            countryCode: "US",
          },
          identifiers: [],
          address: null,
          contacts: [],
          representatives: [],
          licenses: [],
        }),
      },
    );

    expect(requisitesResponse.status).toBe(404);
    await expect(requisitesResponse.json()).resolves.toEqual({
      error: "Counterparty not found: 11111111-1111-4111-8111-111111111111",
    });
    expect(profileResponse.status).toBe(404);
    await expect(profileResponse.json()).resolves.toEqual({
      error: "Counterparty not found: 11111111-1111-4111-8111-111111111111",
    });
    expect(partyProfiles.commands.replaceBundle).not.toHaveBeenCalled();
  });

  it("does not expose the legacy counterparty legal-profile route", async () => {
    const { app } = createTestApp();

    const response = await app.request(
      "http://localhost/counterparties/11111111-1111-4111-8111-111111111111/legal-profile",
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 when assigning a counterparty without a sub-agent profile", async () => {
    const {
      app,
      counterparties,
      counterpartiesQueries,
      subAgentProfiles,
    } = createTestApp();
    counterparties.queries.findById.mockResolvedValue(createCounterparty());
    subAgentProfiles.queries.findById.mockRejectedValue(
      new SubAgentProfileNotFoundError("22222222-2222-4222-8222-222222222222"),
    );

    const response = await app.request(
      "http://localhost/counterparties/11111111-1111-4111-8111-111111111111/assignment",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subAgentCounterpartyId: "22222222-2222-4222-8222-222222222222",
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Sub-agent profile not found: 22222222-2222-4222-8222-222222222222",
    });
    expect(counterpartiesQueries.upsertAssignment).not.toHaveBeenCalled();
  });

  it("returns null sub-agent details for stale assignments", async () => {
    const {
      app,
      counterparties,
      counterpartiesQueries,
      subAgentProfiles,
    } = createTestApp();
    counterparties.queries.findById.mockResolvedValue(createCounterparty());
    counterpartiesQueries.listAssignmentsByCounterpartyIds.mockResolvedValue(
      new Map([
        [
          "11111111-1111-4111-8111-111111111111",
          {
            counterpartyId: "11111111-1111-4111-8111-111111111111",
            subAgentCounterpartyId: "22222222-2222-4222-8222-222222222222",
          },
        ],
      ]),
    );
    subAgentProfiles.queries.findById.mockRejectedValue(
      new SubAgentProfileNotFoundError("22222222-2222-4222-8222-222222222222"),
    );

    const response = await app.request(
      "http://localhost/counterparties/11111111-1111-4111-8111-111111111111/assignment",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      counterpartyId: "11111111-1111-4111-8111-111111111111",
      subAgent: null,
      subAgentCounterpartyId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("resolves /search against the directory routes before /{id}", async () => {
    const {
      counterparties,
      counterpartiesQueries,
      partyProfiles,
      requisites,
      subAgentProfiles,
    } = createTestApp();
    const app = new OpenAPIHono();

    counterparties.queries.findById.mockRejectedValue(
      new CounterpartyNotFoundError("search"),
    );
    counterpartiesQueries.searchCustomerOwnedCounterparties.mockResolvedValue([
      {
        counterpartyId: "11111111-1111-4111-8111-111111111111",
        customerId: "33333333-3333-4333-8333-333333333333",
        inn: "7700000000",
        orgName: "Acme LLC",
        shortName: "Acme",
      },
    ]);

    app.use("*", async (c, next) => {
      c.set("user", { id: "user-1", role: "admin" } as any);
      await next();
    });
    app.route(
      "/counterparties",
      counterpartyDirectoryRoutes({
        env: {},
        partiesReadRuntime: {
          counterpartiesQueries,
        },
      } as any),
    );
    app.route(
      "/counterparties",
      counterpartiesRoutes({
        partiesModule: {
          counterparties,
          partyProfiles,
          requisites,
          subAgentProfiles,
        },
        partiesReadRuntime: {
          counterpartiesQueries,
        },
      } as any),
    );

    const response = await app.request(
      "http://localhost/counterparties/search?q=acme&limit=20&offset=0",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          counterpartyId: "11111111-1111-4111-8111-111111111111",
          customerId: "33333333-3333-4333-8333-333333333333",
          id: "11111111-1111-4111-8111-111111111111",
          inn: "7700000000",
          orgName: "Acme LLC",
          shortName: "Acme",
        },
      ],
      limit: 20,
      offset: 0,
      total: 1,
    });
  });
});
