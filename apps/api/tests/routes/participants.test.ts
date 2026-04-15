import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  authByAudience: {
    finance: {
      api: {
        userHasPermission,
      },
    },
  },
  default: {
    api: {
      userHasPermission,
    },
  },
}));

import { customersRoutes } from "../../src/routes/customers";
import { participantsRoutes } from "../../src/routes/participants";
import { routeComposerRoutes } from "../../src/routes/route-composer";

const IDS = {
  customer: "00000000-0000-4000-8000-000000000500",
  counterparty: "00000000-0000-4000-8000-000000000501",
} as const;

function createTestApp() {
  const participantsQueries = {
    getLookupContext: vi.fn(async () => ({
      lookupDefaults: {
        defaultLimit: 20,
        maxLimit: 50,
        prefixMatching: true,
      },
      participantKinds: [
        {
          backedBy: "customers",
          description: "Commercial account root.",
          internalOnly: false,
          kind: "customer",
          label: "Customer",
          note: null,
        },
      ],
      roleHints: [
        {
          description: "Deal owner.",
          id: "deal_owner",
          label: "Deal owner",
        },
      ],
      strictSemantics: {
        accessControlOwnedByIam: true,
        customerLegalEntitiesViaCounterparties: true,
        organizationsInternalOnly: true,
        subAgentsRequireCanonicalProfile: true,
      },
    })),
    listCustomerLegalEntities: vi.fn(async () => ({
      data: [
        {
          country: "AE",
          customerId: IDS.customer,
          displayName: "Acme Trading LLC",
          id: IDS.counterparty,
          isActive: true,
          legalName: "Acme Trading LLC",
          participantKind: "counterparty",
          partyKind: "legal_entity",
          relationshipKind: "customer_owned",
          requisites: {
            bankCount: 1,
            hasDefault: true,
            totalCount: 2,
          },
          roleHints: ["customer_legal_entity"],
          shortName: "Acme Trading LLC",
        },
      ],
    })),
    lookup: vi.fn(async () => ({
      data: [
        {
          country: null,
          customerId: null,
          displayName: "Acme Group",
          id: IDS.customer,
          isActive: true,
          legalName: "Acme Group",
          participantKind: "customer",
          partyKind: null,
          relationshipKind: null,
          requisites: {
            bankCount: 0,
            hasDefault: false,
            totalCount: 0,
          },
          roleHints: ["deal_owner"],
          shortName: null,
        },
      ],
    })),
  };
  const customersQueries = {
    findById: vi.fn(async (id: string) =>
      id === IDS.customer
        ? {
            id,
            externalRef: null,
            name: "Acme Group",
            description: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
          }
        : null,
    ),
  };

  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("audience", "finance");
    c.set("user", { id: "user-1", role: "finance" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: null,
    });
    await next();
  });

  const ctx = {
    partiesModule: {
      customers: {
        queries: customersQueries,
      },
      participants: {
        queries: participantsQueries,
      },
    },
  } as any;

  app.route("/participants", participantsRoutes(ctx));
  app.route("/route-composer", routeComposerRoutes(ctx));
  app.route("/customers", customersRoutes(ctx));

  return { app, customersQueries, participantsQueries };
}

describe("participant routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("delegates typed participant lookup to the parties module", async () => {
    const { app, participantsQueries } = createTestApp();

    const response = await app.request(
      "http://localhost/participants/lookup?q=Ac&kind=customer&limit=5",
    );

    expect(response.status).toBe(200);
    expect(participantsQueries.lookup).toHaveBeenCalledWith({
      activeOnly: true,
      kind: "customer",
      limit: 5,
      q: "Ac",
    });
    await expect(response.json()).resolves.toEqual({
      data: [
        expect.objectContaining({
          displayName: "Acme Group",
          participantKind: "customer",
        }),
      ],
    });
  });

  it("returns route composer lookup context", async () => {
    const { app, participantsQueries } = createTestApp();

    const response = await app.request(
      "http://localhost/route-composer/lookup-context",
    );

    expect(response.status).toBe(200);
    expect(participantsQueries.getLookupContext).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        lookupDefaults: expect.objectContaining({
          defaultLimit: 20,
        }),
      }),
    );
  });

  it("lists customer legal entities through participants lookup", async () => {
    const { app, customersQueries, participantsQueries } = createTestApp();

    const response = await app.request(
      `http://localhost/customers/${IDS.customer}/legal-entities?q=Acme&limit=7`,
    );

    expect(response.status).toBe(200);
    expect(customersQueries.findById).toHaveBeenCalledWith(IDS.customer);
    expect(participantsQueries.listCustomerLegalEntities).toHaveBeenCalledWith({
      customerId: IDS.customer,
      query: {
        limit: 7,
        q: "Acme",
      },
    });
    await expect(response.json()).resolves.toEqual({
      data: [
        expect.objectContaining({
          participantKind: "counterparty",
          roleHints: ["customer_legal_entity"],
        }),
      ],
    });
  });

  it("returns 404 for legal-entity lookup when customer is missing", async () => {
    const { app, participantsQueries } = createTestApp();

    const response = await app.request(
      "http://localhost/customers/00000000-0000-4000-8000-000000000599/legal-entities",
    );

    expect(response.status).toBe(404);
    expect(participantsQueries.listCustomerLegalEntities).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error:
        "Customer not found: 00000000-0000-4000-8000-000000000599",
    });
  });
});
