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

import { internalDealCapabilitiesRoutes } from "../../src/routes/internal-deal-capabilities";

function createTestApp() {
  const dealsModule = {
    deals: {
      commands: {
        upsertCapabilityState: vi.fn(),
      },
      queries: {
        listCapabilityStates: vi.fn(),
      },
    },
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    await next();
  });

  app.route(
    "/internal/deal-capabilities",
    internalDealCapabilitiesRoutes({ dealsModule } as any),
  );

  return { app, dealsModule };
}

describe("internal deal capabilities routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("lists capability states", async () => {
    const { app, dealsModule } = createTestApp();
    dealsModule.deals.queries.listCapabilityStates.mockResolvedValue([
      {
        applicantCounterpartyId: "00000000-0000-4000-8000-000000000001",
        dealType: "payment",
        internalEntityOrganizationId: "00000000-0000-4000-8000-000000000002",
        kind: "can_payout",
        note: null,
        reasonCode: null,
        status: "enabled",
        updatedAt: new Date("2026-04-02T10:00:00.000Z"),
        updatedByUserId: "user-1",
      },
    ]);

    const response = await app.request(
      "/internal/deal-capabilities?dealType=payment",
    );

    expect(response.status).toBe(200);
    expect(dealsModule.deals.queries.listCapabilityStates).toHaveBeenCalledWith({
      dealType: "payment",
    });
  });

  it("upserts capability state deterministically", async () => {
    const { app, dealsModule } = createTestApp();
    dealsModule.deals.commands.upsertCapabilityState.mockResolvedValue({
      applicantCounterpartyId: "00000000-0000-4000-8000-000000000001",
      dealType: "payment",
      internalEntityOrganizationId: "00000000-0000-4000-8000-000000000002",
      kind: "can_payout",
      note: "Manual enablement",
      reasonCode: null,
      status: "enabled",
      updatedAt: new Date("2026-04-02T10:05:00.000Z"),
      updatedByUserId: "user-1",
    });

    const response = await app.request("/internal/deal-capabilities", {
      body: JSON.stringify({
        applicantCounterpartyId: "00000000-0000-4000-8000-000000000001",
        capabilityKind: "can_payout",
        dealType: "payment",
        internalEntityOrganizationId: "00000000-0000-4000-8000-000000000002",
        note: "Manual enablement",
        reasonCode: null,
        status: "enabled",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "PUT",
    });

    expect(response.status).toBe(200);
    expect(dealsModule.deals.commands.upsertCapabilityState).toHaveBeenCalledWith({
      actorUserId: "user-1",
      applicantCounterpartyId: "00000000-0000-4000-8000-000000000001",
      capabilityKind: "can_payout",
      dealType: "payment",
      internalEntityOrganizationId: "00000000-0000-4000-8000-000000000002",
      note: "Manual enablement",
      reasonCode: null,
      status: "enabled",
    });
  });
});
