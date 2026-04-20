import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerNotFoundError } from "@bedrock/parties";
import { RateNotFoundError, RateSourceStaleError } from "@bedrock/treasury";

import { paymentRoutesRoutes } from "../../src/routes/payment-routes";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  authByAudience: {
    crm: {
      api: {
        userHasPermission,
      },
    },
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

const IDS = {
  customer: "00000000-0000-4000-8000-000000000001",
  organization: "00000000-0000-4000-8000-000000000002",
  counterparty: "00000000-0000-4000-8000-000000000003",
  route: "00000000-0000-4000-8000-000000000004",
  duplicateRoute: "00000000-0000-4000-8000-000000000005",
  organizationUsdRequisite: "00000000-0000-4000-8000-000000000006",
  counterpartyUsdRequisite: "00000000-0000-4000-8000-000000000007",
  organizationEurRequisite: "00000000-0000-4000-8000-000000000008",
  usd: "00000000-0000-4000-8000-000000000101",
  eur: "00000000-0000-4000-8000-000000000102",
} as const;

const NOW = "2026-04-16T08:00:00.000Z";

function createVisual() {
  return {
    nodePositions: {
      "node-customer": { x: 0, y: 80 },
      "node-organization": { x: 280, y: 80 },
    },
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function createDraft() {
  return {
    additionalFees: [],
    amountInMinor: "10000",
    amountOutMinor: "10000",
    currencyInId: IDS.usd,
    currencyOutId: IDS.usd,
    legs: [
      {
        fees: [
          {
            amountMinor: "100",
            chargeToCustomer: false,
            currencyId: IDS.usd,
            id: "fee-1",
            kind: "fixed",
            label: "Bank fee",
          },
        ],
        fromCurrencyId: IDS.usd,
        id: "leg-1",
        toCurrencyId: IDS.usd,
      },
    ],
    lockedSide: "currency_in",
    participants: [
      {
        binding: "bound",
        displayName: "placeholder",
        entityId: IDS.customer,
        entityKind: "customer",
        nodeId: "node-customer",
        requisiteId: null,
        role: "source",
      },
      {
        binding: "bound",
        displayName: "placeholder",
        entityId: IDS.organization,
        entityKind: "organization",
        nodeId: "node-organization",
        requisiteId: null,
        role: "destination",
      },
    ],
  } as const;
}

function createAbstractDraft() {
  return {
    ...createDraft(),
    participants: [
      {
        binding: "abstract",
        displayName: "Клиент",
        entityId: null,
        entityKind: null,
        nodeId: "node-customer",
        requisiteId: null,
        role: "source",
      },
      {
        binding: "abstract",
        displayName: "Бенефициар",
        entityId: null,
        entityKind: null,
        nodeId: "node-organization",
        requisiteId: null,
        role: "destination",
      },
    ],
  } as const;
}

function createCalculation() {
  return {
    additionalFees: [],
    amountInMinor: "10000",
    amountOutMinor: "9900",
    chargedFeeTotals: [
      {
        amountMinor: "100",
        currencyId: IDS.usd,
      },
    ],
    cleanAmountOutMinor: "10000",
    clientTotalInMinor: "10000",
    computedAt: NOW,
    costPriceInMinor: "10000",
    currencyInId: IDS.usd,
    currencyOutId: IDS.usd,
    feeTotals: [
      {
        amountMinor: "100",
        currencyId: IDS.usd,
      },
    ],
    grossAmountOutMinor: "10000",
    internalFeeTotals: [],
    legs: [
      {
        asOf: NOW,
        fees: [
          {
            amountMinor: "100",
            chargeToCustomer: true,
            currencyId: IDS.usd,
            id: "fee-1",
            inputImpactCurrencyId: IDS.usd,
            inputImpactMinor: "100",
            kind: "fixed",
            label: "Bank fee",
            outputImpactCurrencyId: IDS.usd,
            outputImpactMinor: "100",
          },
        ],
        fromCurrencyId: IDS.usd,
        grossOutputMinor: "10000",
        id: "leg-1",
        idx: 1,
        inputAmountMinor: "10000",
        netOutputMinor: "9900",
        rateDen: "1",
        rateNum: "1",
        rateSource: "identity",
        toCurrencyId: IDS.usd,
      },
    ],
    lockedSide: "currency_in",
    netAmountOutMinor: "9900",
  } as const;
}

function createTemplate(overrides: Record<string, unknown> = {}) {
  const draft = {
    ...createDraft(),
    participants: [
      {
        binding: "bound",
        displayName: "Acme Customer",
        entityId: IDS.customer,
        entityKind: "customer",
        nodeId: "node-customer",
        requisiteId: null,
        role: "source",
      },
      {
        binding: "bound",
        displayName: "Bedrock Treasury",
        entityId: IDS.organization,
        entityKind: "organization",
        nodeId: "node-organization",
        requisiteId: null,
        role: "destination",
      },
    ],
  };

  return {
    createdAt: NOW,
    draft,
    id: IDS.route,
    lastCalculation: createCalculation(),
    name: "USD payout",
    snapshotPolicy: "clone_on_attach",
    status: "active",
    updatedAt: NOW,
    visual: createVisual(),
    ...overrides,
  };
}

function createListItem() {
  const template = createTemplate();

  return {
    createdAt: template.createdAt,
    currencyInId: template.draft.currencyInId,
    currencyOutId: template.draft.currencyOutId,
    destinationEndpoint: template.draft.participants[1],
    hopCount: 0,
    id: template.id,
    lastCalculation: template.lastCalculation,
    name: template.name,
    snapshotPolicy: template.snapshotPolicy,
    sourceEndpoint: template.draft.participants[0],
    status: template.status,
    updatedAt: template.updatedAt,
  };
}

function createTestApp() {
  const listTemplates = vi.fn();
  const findTemplateById = vi.fn();
  const previewTemplate = vi.fn();
  const createTemplateCommand = vi.fn();
  const updateTemplate = vi.fn();
  const duplicateTemplate = vi.fn();
  const archiveTemplate = vi.fn();
  const findCustomerById = vi.fn(async () => ({
    id: IDS.customer,
    name: "Acme Customer",
  }));
  const findOrganizationById = vi.fn(async () => ({
    id: IDS.organization,
    shortName: "Bedrock Treasury",
  }));
  const findCounterpartyById = vi.fn(async () => ({
    id: IDS.counterparty,
    shortName: "Core Bank",
  }));
  const findRequisiteById = vi.fn(async (id: string) => {
    if (id === IDS.organizationUsdRequisite) {
      return {
        archivedAt: null,
        currencyId: IDS.usd,
        id,
        ownerId: IDS.organization,
        ownerType: "organization",
      };
    }

    if (id === IDS.counterpartyUsdRequisite) {
      return {
        archivedAt: null,
        currencyId: IDS.usd,
        id,
        ownerId: IDS.counterparty,
        ownerType: "counterparty",
      };
    }

    if (id === IDS.organizationEurRequisite) {
      return {
        archivedAt: null,
        currencyId: IDS.eur,
        id,
        ownerId: IDS.organization,
        ownerType: "organization",
      };
    }

    return null;
  });

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("audience", "finance");
    c.set("user", { id: "user-1" } as any);
    await next();
  });
  app.route(
    "/payment-routes",
    paymentRoutesRoutes({
      partiesModule: {
        counterparties: {
          queries: {
            findById: findCounterpartyById,
          },
        },
        customers: {
          queries: {
            findById: findCustomerById,
          },
        },
        organizations: {
          queries: {
            findById: findOrganizationById,
          },
        },
        requisites: {
          queries: {
            findById: findRequisiteById,
          },
        },
      },
      treasuryModule: {
        paymentRoutes: {
          commands: {
            archiveTemplate,
            createTemplate: createTemplateCommand,
            duplicateTemplate,
            updateTemplate,
          },
          queries: {
            findTemplateById,
            listTemplates,
            previewTemplate,
          },
        },
      },
    } as any),
  );

  return {
    app,
    archiveTemplate,
    createTemplateCommand,
    duplicateTemplate,
    findCounterpartyById,
    findCustomerById,
    findOrganizationById,
    findRequisiteById,
    findTemplateById,
    listTemplates,
    previewTemplate,
    updateTemplate,
  };
}

describe("payment routes routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("lists payment route templates with validated filters", async () => {
    const { app, listTemplates } = createTestApp();

    listTemplates.mockResolvedValue({
      data: [createListItem()],
      limit: 5,
      offset: 10,
      total: 1,
    });

    const response = await app.request(
      "http://localhost/payment-routes?limit=5&offset=10&sortBy=name&sortOrder=asc&name=USD&status=active",
    );

    expect(response.status).toBe(200);
    expect(listTemplates).toHaveBeenCalledWith({
      limit: 5,
      name: "USD",
      offset: 10,
      sortBy: "name",
      sortOrder: "asc",
      status: "active",
    });
    await expect(response.json()).resolves.toEqual({
      data: [createListItem()],
      limit: 5,
      offset: 10,
      total: 1,
    });
  });

  it("creates templates after resolving canonical participant display names", async () => {
    const { app, createTemplateCommand } = createTestApp();

    createTemplateCommand.mockResolvedValue(createTemplate());

    const response = await app.request("http://localhost/payment-routes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        draft: createDraft(),
        name: "USD payout",
        visual: createVisual(),
      }),
    });

    expect(response.status).toBe(201);
    expect(createTemplateCommand).toHaveBeenCalledWith({
      draft: {
        ...createDraft(),
        participants: [
          {
            binding: "bound",
            displayName: "Acme Customer",
            entityId: IDS.customer,
            entityKind: "customer",
            nodeId: "node-customer",
            requisiteId: null,
            role: "source",
          },
          {
            binding: "bound",
            displayName: "Bedrock Treasury",
            entityId: IDS.organization,
            entityKind: "organization",
            nodeId: "node-organization",
            requisiteId: null,
            role: "destination",
          },
        ],
      },
      name: "USD payout",
      visual: createVisual(),
    });
    await expect(response.json()).resolves.toMatchObject({
      id: IDS.route,
      name: "USD payout",
    });
  });

  it("gets, updates, duplicates, and archives templates", async () => {
    const {
      app,
      archiveTemplate,
      duplicateTemplate,
      findTemplateById,
      updateTemplate,
    } = createTestApp();

    findTemplateById.mockResolvedValue(createTemplate());
    updateTemplate.mockResolvedValue(createTemplate({ name: "Updated route" }));
    duplicateTemplate.mockResolvedValue(
      createTemplate({
        id: IDS.duplicateRoute,
        name: "USD payout (копия)",
      }),
    );
    archiveTemplate.mockResolvedValue(
      createTemplate({
        status: "archived",
      }),
    );

    const getResponse = await app.request(
      `http://localhost/payment-routes/${IDS.route}`,
    );
    const updateResponse = await app.request(
      `http://localhost/payment-routes/${IDS.route}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Updated route" }),
      },
    );
    const duplicateResponse = await app.request(
      `http://localhost/payment-routes/${IDS.route}/duplicate`,
      {
        method: "POST",
      },
    );
    const archiveResponse = await app.request(
      `http://localhost/payment-routes/${IDS.route}/archive`,
      {
        method: "POST",
      },
    );

    expect(getResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(duplicateResponse.status).toBe(201);
    expect(archiveResponse.status).toBe(200);
    expect(findTemplateById).toHaveBeenCalledWith(IDS.route);
    expect(updateTemplate).toHaveBeenCalledWith(IDS.route, {
      name: "Updated route",
    });
    expect(duplicateTemplate).toHaveBeenCalledWith(IDS.route);
    expect(archiveTemplate).toHaveBeenCalledWith(IDS.route);
  });

  it("previews routes with normalized participant display names", async () => {
    const { app, previewTemplate } = createTestApp();

    previewTemplate.mockResolvedValue(createCalculation());

    const response = await app.request(
      "http://localhost/payment-routes/preview",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: createDraft(),
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(previewTemplate).toHaveBeenCalledWith({
      draft: {
        ...createDraft(),
        participants: [
          {
            binding: "bound",
            displayName: "Acme Customer",
            entityId: IDS.customer,
            entityKind: "customer",
            nodeId: "node-customer",
            requisiteId: null,
            role: "source",
          },
          {
            binding: "bound",
            displayName: "Bedrock Treasury",
            entityId: IDS.organization,
            entityKind: "organization",
            nodeId: "node-organization",
            requisiteId: null,
            role: "destination",
          },
        ],
      },
    });
    await expect(response.json()).resolves.toMatchObject({
      amountOutMinor: "9900",
      netAmountOutMinor: "9900",
    });
  });

  it("returns 503 when previewing a route requires refreshing a stale rate source", async () => {
    const { app, previewTemplate } = createTestApp();

    previewTemplate.mockRejectedValue(
      new RateSourceStaleError("cbr", new Error("cbr: request GetCursOnDate failed")),
    );

    const response = await app.request(
      "http://localhost/payment-routes/preview",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: createDraft(),
        }),
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Rate source is stale and refresh failed: cbr",
    });
  });

  it("returns 404 when a preview route cannot resolve a market rate", async () => {
    const { app, previewTemplate } = createTestApp();

    previewTemplate.mockRejectedValue(
      new RateNotFoundError("Rate not found for USD/AED asOf=2026-04-16T08:00:00.000Z"),
    );

    const response = await app.request(
      "http://localhost/payment-routes/preview",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: createDraft(),
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Rate not found for USD/AED asOf=2026-04-16T08:00:00.000Z",
    });
  });

  it("rejects unknown entity refs while normalizing participants", async () => {
    const { app, createTemplateCommand, findCustomerById } = createTestApp();

    findCustomerById.mockRejectedValueOnce(new CustomerNotFoundError(IDS.customer));

    const response = await app.request("http://localhost/payment-routes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        draft: createDraft(),
        name: "USD payout",
        visual: createVisual(),
      }),
    });

    expect(response.status).toBe(400);
    expect(createTemplateCommand).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("Customer not found"),
    });
  });

  it("creates templates with abstract endpoints without resolving party records", async () => {
    const {
      app,
      createTemplateCommand,
      findCounterpartyById,
      findCustomerById,
      findOrganizationById,
    } = createTestApp();

    createTemplateCommand.mockResolvedValue(
      createTemplate({
        draft: createAbstractDraft(),
      }),
    );

    const response = await app.request("http://localhost/payment-routes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        draft: createAbstractDraft(),
        name: "Generic USD payout",
        visual: createVisual(),
      }),
    });

    expect(response.status).toBe(201);
    expect(createTemplateCommand).toHaveBeenCalledWith({
      draft: createAbstractDraft(),
      name: "Generic USD payout",
      visual: createVisual(),
    });
    expect(findCustomerById).not.toHaveBeenCalled();
    expect(findOrganizationById).not.toHaveBeenCalled();
    expect(findCounterpartyById).not.toHaveBeenCalled();
  });

  it("previews mixed abstract and bound endpoints", async () => {
    const {
      app,
      findCustomerById,
      findOrganizationById,
      previewTemplate,
    } = createTestApp();

    previewTemplate.mockResolvedValue(createCalculation());

    const response = await app.request(
      "http://localhost/payment-routes/preview",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: {
            ...createDraft(),
            participants: [
              createDraft().participants[0],
              {
                binding: "abstract",
                displayName: "Бенефициар",
                entityId: null,
                entityKind: null,
                nodeId: "node-organization",
                requisiteId: null,
                role: "destination",
              },
            ],
          },
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(previewTemplate).toHaveBeenCalledWith({
      draft: {
        ...createDraft(),
        participants: [
          {
            binding: "bound",
            displayName: "Acme Customer",
            entityId: IDS.customer,
            entityKind: "customer",
            nodeId: "node-customer",
            requisiteId: null,
            role: "source",
          },
          {
            binding: "abstract",
            displayName: "Бенефициар",
            entityId: null,
            entityKind: null,
            nodeId: "node-organization",
            requisiteId: null,
            role: "destination",
          },
        ],
      },
    });
    expect(findCustomerById).toHaveBeenCalledTimes(1);
    expect(findOrganizationById).not.toHaveBeenCalled();
  });

  it("rejects invalid fee payloads before the preview handler runs", async () => {
    const { app, previewTemplate } = createTestApp();

    const draft = createDraft();
    const response = await app.request(
      "http://localhost/payment-routes/preview",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: {
            ...draft,
            legs: [
              {
                ...draft.legs[0],
                fees: [
                  {
                    currencyId: IDS.usd,
                    id: "fee-invalid",
                    kind: "percent",
                    label: "Broken percent fee",
                    percentage: "1",
                  },
                ],
              },
            ],
          },
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(previewTemplate).not.toHaveBeenCalled();
  });

  it("rejects legacy route payloads that still include leg kind", async () => {
    const {
      app,
      createTemplateCommand,
      previewTemplate,
      updateTemplate,
    } = createTestApp();
    const invalidDraft = {
      ...createDraft(),
      legs: [
        {
          ...createDraft().legs[0],
          kind: "transfer",
        },
      ],
    };

    const [createResponse, updateResponse, previewResponse] = await Promise.all([
      app.request("http://localhost/payment-routes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: invalidDraft,
          name: "USD payout",
          visual: createVisual(),
        }),
      }),
      app.request(`http://localhost/payment-routes/${IDS.route}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: invalidDraft,
        }),
      }),
      app.request("http://localhost/payment-routes/preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: invalidDraft,
        }),
      }),
    ]);

    expect(createResponse.status).toBe(400);
    expect(updateResponse.status).toBe(400);
    expect(previewResponse.status).toBe(400);
    expect(createTemplateCommand).not.toHaveBeenCalled();
    expect(updateTemplate).not.toHaveBeenCalled();
    expect(previewTemplate).not.toHaveBeenCalled();
  });

  it("accepts a valid selected requisite for a bound organization participant", async () => {
    const { app, createTemplateCommand, findRequisiteById } = createTestApp();

    createTemplateCommand.mockResolvedValue(
      createTemplate({
        draft: {
          ...createDraft(),
          participants: [
            createDraft().participants[0],
            {
              ...createDraft().participants[1],
              requisiteId: IDS.organizationUsdRequisite,
            },
          ],
        },
      }),
    );

    const response = await app.request("http://localhost/payment-routes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        draft: {
          ...createDraft(),
          participants: [
            createDraft().participants[0],
            {
              ...createDraft().participants[1],
              requisiteId: IDS.organizationUsdRequisite,
            },
          ],
        },
        name: "USD payout",
        visual: createVisual(),
      }),
    });

    expect(response.status).toBe(201);
    expect(findRequisiteById).toHaveBeenCalledWith(IDS.organizationUsdRequisite);
    expect(createTemplateCommand).toHaveBeenCalledWith({
      draft: {
        ...createDraft(),
        participants: [
          {
            ...createDraft().participants[0],
            displayName: "Acme Customer",
          },
          {
            ...createDraft().participants[1],
            displayName: "Bedrock Treasury",
            requisiteId: IDS.organizationUsdRequisite,
          },
        ],
      },
      name: "USD payout",
      visual: createVisual(),
    });
  });

  it("rejects a selected requisite when the owner does not match the participant", async () => {
    const { app, createTemplateCommand } = createTestApp();

    const response = await app.request("http://localhost/payment-routes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        draft: {
          ...createDraft(),
          participants: [
            createDraft().participants[0],
            {
              ...createDraft().participants[1],
              requisiteId: IDS.counterpartyUsdRequisite,
            },
          ],
        },
        name: "USD payout",
        visual: createVisual(),
      }),
    });

    expect(response.status).toBe(400);
    expect(createTemplateCommand).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: "Реквизит не принадлежит выбранному участнику маршрута",
    });
  });

  it("rejects a selected requisite when the currency does not match the participant step", async () => {
    const { app, previewTemplate } = createTestApp();

    const response = await app.request(
      "http://localhost/payment-routes/preview",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: {
            ...createDraft(),
            participants: [
              createDraft().participants[0],
              {
                ...createDraft().participants[1],
                requisiteId: IDS.organizationEurRequisite,
              },
            ],
          },
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(previewTemplate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: "Валюта реквизита не совпадает с валютой шага маршрута",
    });
  });
});
