import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    portal: {
      api: {
        userHasPermission,
      },
    },
  },
}));

import { routeComposerRoutes } from "../../src/routes/route-composer";

function createRouteTemplate() {
  const now = new Date("2026-04-14T10:00:00.000Z");

  return {
    code: "rub-aed-usd-payout",
    costComponents: [],
    createdAt: now,
    dealType: "payment" as const,
    description: "RUB collection -> AED transfer -> USD payout",
    id: "00000000-0000-4000-8000-000000000501",
    legs: [
      {
        code: "collect",
        executionCounterpartyId: null,
        expectedFromAmountMinor: "100000",
        expectedRateDen: null,
        expectedRateNum: null,
        expectedToAmountMinor: "100000",
        fromCurrencyId: "00000000-0000-4000-8000-000000000006",
        fromParticipantCode: "customer",
        id: "00000000-0000-4000-8000-000000000511",
        idx: 1,
        kind: "collection" as const,
        notes: null,
        settlementModel: "incoming_receipt",
        toCurrencyId: "00000000-0000-4000-8000-000000000006",
        toParticipantCode: "ops",
      },
    ],
    name: "RUB to USD payout",
    participants: [
      {
        bindingKind: "deal_customer" as const,
        code: "customer",
        displayNameTemplate: "Customer",
        id: "00000000-0000-4000-8000-000000000521",
        metadata: {},
        partyId: null,
        partyKind: "customer" as const,
        requisiteId: null,
        role: "source_customer",
        sequence: 1,
      },
      {
        bindingKind: "fixed_party" as const,
        code: "ops",
        displayNameTemplate: "Multihansa",
        id: "00000000-0000-4000-8000-000000000522",
        metadata: {},
        partyId: "00000000-0000-4000-8000-000000000020",
        partyKind: "organization" as const,
        requisiteId: "00000000-0000-4000-8000-000000000021",
        role: "treasury_hub",
        sequence: 2,
      },
    ],
    status: "draft" as const,
    updatedAt: now,
  };
}

function createTestApp() {
  const dealsModule = {
    deals: {
      commands: {
        archiveRouteTemplate: vi.fn(),
        createRouteTemplate: vi.fn(),
        publishRouteTemplate: vi.fn(),
        updateRouteTemplate: vi.fn(),
      },
      queries: {
        findRouteTemplateById: vi.fn(),
        listRouteTemplates: vi.fn(),
      },
    },
  };
  const partiesModule = {
    participants: {
      queries: {
        getLookupContext: vi.fn(async () => ({
          participantKinds: [
            {
              code: "customer",
              label: "Customer",
            },
          ],
        })),
      },
    },
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    await next();
  });

  app.route(
    "/route-composer",
    routeComposerRoutes({
      dealsModule,
      partiesModule,
    } as any),
  );

  return {
    app,
    dealsModule,
    partiesModule,
  };
}

describe("route composer routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("lists route templates with filters", async () => {
    const { app, dealsModule } = createTestApp();
    const template = createRouteTemplate();
    dealsModule.deals.queries.listRouteTemplates.mockResolvedValue([template]);

    const response = await app.request(
      "http://localhost/route-composer/templates?dealType=payment&status=draft",
    );

    expect(response.status).toBe(200);
    expect(dealsModule.deals.queries.listRouteTemplates).toHaveBeenCalledWith({
      dealType: "payment",
      status: ["draft"],
    });
    await expect(response.json()).resolves.toMatchObject([
      {
        id: template.id,
        code: template.code,
        status: template.status,
      },
    ]);
  });

  it("creates a route template", async () => {
    const { app, dealsModule } = createTestApp();
    const template = createRouteTemplate();
    dealsModule.deals.commands.createRouteTemplate.mockResolvedValue(template);

    const response = await app.request("http://localhost/route-composer/templates", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code: template.code,
        name: template.name,
        description: template.description,
        dealType: template.dealType,
        participants: template.participants.map((participant) => ({
          bindingKind: participant.bindingKind,
          code: participant.code,
          displayNameTemplate: participant.displayNameTemplate,
          metadata: participant.metadata,
          partyId: participant.partyId,
          partyKind: participant.partyKind,
          requisiteId: participant.requisiteId,
          role: participant.role,
          sequence: participant.sequence,
        })),
        legs: template.legs.map((leg) => ({
          code: leg.code,
          executionCounterpartyId: leg.executionCounterpartyId,
          expectedFromAmountMinor: leg.expectedFromAmountMinor,
          expectedRateDen: leg.expectedRateDen,
          expectedRateNum: leg.expectedRateNum,
          expectedToAmountMinor: leg.expectedToAmountMinor,
          fromCurrencyId: leg.fromCurrencyId,
          fromParticipantCode: leg.fromParticipantCode,
          idx: leg.idx,
          kind: leg.kind,
          notes: leg.notes,
          settlementModel: leg.settlementModel,
          toCurrencyId: leg.toCurrencyId,
          toParticipantCode: leg.toParticipantCode,
        })),
        costComponents: [],
      }),
    });

    expect(response.status).toBe(201);
    expect(dealsModule.deals.commands.createRouteTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        code: template.code,
        name: template.name,
        dealType: template.dealType,
      }),
    );
  });

  it("publishes a route template", async () => {
    const { app, dealsModule } = createTestApp();
    const template = {
      ...createRouteTemplate(),
      status: "published" as const,
    };
    dealsModule.deals.commands.publishRouteTemplate.mockResolvedValue(template);

    const response = await app.request(
      `http://localhost/route-composer/templates/${template.id}/publish`,
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
    expect(
      dealsModule.deals.commands.publishRouteTemplate,
    ).toHaveBeenCalledWith({
      templateId: template.id,
    });
  });
});
