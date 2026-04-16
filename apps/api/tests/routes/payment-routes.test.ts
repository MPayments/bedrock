import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerNotFoundError } from "@bedrock/parties";

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
  usd: "00000000-0000-4000-8000-000000000101",
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
            currencyId: IDS.usd,
            id: "fee-1",
            kind: "fixed",
            label: "Bank fee",
          },
        ],
        fromCurrencyId: IDS.usd,
        id: "leg-1",
        kind: "transfer",
        toCurrencyId: IDS.usd,
      },
    ],
    lockedSide: "currency_in",
    participants: [
      {
        displayName: "placeholder",
        entityId: IDS.customer,
        kind: "customer",
        nodeId: "node-customer",
      },
      {
        displayName: "placeholder",
        entityId: IDS.organization,
        kind: "organization",
        nodeId: "node-organization",
      },
    ],
  } as const;
}

function createCalculation() {
  return {
    additionalFees: [],
    amountInMinor: "10000",
    amountOutMinor: "9900",
    computedAt: NOW,
    currencyInId: IDS.usd,
    currencyOutId: IDS.usd,
    feeTotals: [
      {
        amountMinor: "100",
        currencyId: IDS.usd,
      },
    ],
    grossAmountOutMinor: "10000",
    legs: [
      {
        asOf: NOW,
        fees: [
          {
            amountMinor: "100",
            currencyId: IDS.usd,
            id: "fee-1",
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
        kind: "transfer",
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
        displayName: "Acme Customer",
        entityId: IDS.customer,
        kind: "customer",
        nodeId: "node-customer",
      },
      {
        displayName: "Bedrock Treasury",
        entityId: IDS.organization,
        kind: "organization",
        nodeId: "node-organization",
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
    destinationParticipant: template.draft.participants[1],
    hopCount: 0,
    id: template.id,
    lastCalculation: template.lastCalculation,
    name: template.name,
    snapshotPolicy: template.snapshotPolicy,
    sourceParticipant: template.draft.participants[0],
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
            displayName: "Acme Customer",
            entityId: IDS.customer,
            kind: "customer",
            nodeId: "node-customer",
          },
          {
            displayName: "Bedrock Treasury",
            entityId: IDS.organization,
            kind: "organization",
            nodeId: "node-organization",
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
            displayName: "Acme Customer",
            entityId: IDS.customer,
            kind: "customer",
            nodeId: "node-customer",
          },
          {
            displayName: "Bedrock Treasury",
            entityId: IDS.organization,
            kind: "organization",
            nodeId: "node-organization",
          },
        ],
      },
    });
    await expect(response.json()).resolves.toMatchObject({
      amountOutMinor: "9900",
      netAmountOutMinor: "9900",
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
});
