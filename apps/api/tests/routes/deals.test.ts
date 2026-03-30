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

import { DealNotFoundError } from "@bedrock/deals";

import { dealsRoutes } from "../../src/routes/deals";

function createDealDetail() {
  const now = new Date("2026-03-30T00:00:00.000Z");

  return {
    id: "00000000-0000-4000-8000-000000000010",
    customerId: "00000000-0000-4000-8000-000000000001",
    agreementId: "00000000-0000-4000-8000-000000000002",
    calculationId: "00000000-0000-4000-8000-000000000003",
    type: "payment" as const,
    status: "draft" as const,
    comment: "Draft payment deal",
    createdAt: now,
    updatedAt: now,
    legs: [
      {
        id: "00000000-0000-4000-8000-000000000011",
        idx: 1,
        kind: "payment" as const,
        status: "draft" as const,
        createdAt: now,
        updatedAt: now,
      },
    ],
    participants: [
      {
        id: "00000000-0000-4000-8000-000000000012",
        role: "customer" as const,
        partyId: "00000000-0000-4000-8000-000000000001",
        customerId: "00000000-0000-4000-8000-000000000001",
        organizationId: null,
        counterpartyId: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    statusHistory: [
      {
        id: "00000000-0000-4000-8000-000000000013",
        status: "draft" as const,
        changedBy: "user-1",
        comment: "Draft payment deal",
        createdAt: now,
      },
    ],
    approvals: [],
  };
}

function createDealsModuleStub() {
  return {
    deals: {
      queries: {
        list: vi.fn(),
        findById: vi.fn(),
      },
      commands: {
        create: vi.fn(),
      },
    },
  };
}

function createTestApp() {
  const dealsModule = createDealsModuleStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: c.req.header("idempotency-key") ?? null,
    });
    await next();
  });

  app.route("/deals", dealsRoutes({ dealsModule } as any));

  return { app, dealsModule };
}

describe("deals routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("lists, fetches, and creates canonical deals", async () => {
    const { app, dealsModule } = createTestApp();
    const detail = createDealDetail();
    dealsModule.deals.queries.list.mockResolvedValue({
      data: [
        {
          id: detail.id,
          customerId: detail.customerId,
          agreementId: detail.agreementId,
          calculationId: detail.calculationId,
          type: detail.type,
          status: detail.status,
          comment: detail.comment,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    dealsModule.deals.queries.findById.mockResolvedValue(detail);
    dealsModule.deals.commands.create.mockResolvedValue(detail);

    const listResponse = await app.request("http://localhost/deals");
    const getResponse = await app.request(`http://localhost/deals/${detail.id}`);
    const createResponse = await app.request("http://localhost/deals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "deal-create-1",
      },
      body: JSON.stringify({
        customerId: detail.customerId,
        agreementId: detail.agreementId,
        calculationId: detail.calculationId,
        type: "payment",
        comment: detail.comment,
      }),
    });

    expect(listResponse.status).toBe(200);
    expect(getResponse.status).toBe(200);
    expect(createResponse.status).toBe(201);

    expect(dealsModule.deals.queries.list).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(dealsModule.deals.queries.findById).toHaveBeenCalledWith(detail.id);
    expect(dealsModule.deals.commands.create).toHaveBeenCalledWith({
      customerId: detail.customerId,
      agreementId: detail.agreementId,
      calculationId: detail.calculationId,
      type: "payment",
      agentId: null,
      comment: detail.comment,
      intakeComment: null,
      reason: null,
      requestedAmount: null,
      actorUserId: "user-1",
      idempotencyKey: "deal-create-1",
    });
  });

  it("returns 404 when a deal is missing", async () => {
    const { app, dealsModule } = createTestApp();
    dealsModule.deals.queries.findById.mockRejectedValue(
      new DealNotFoundError("00000000-0000-4000-8000-000000000099"),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000099",
    );

    expect(response.status).toBe(404);
  });
});
