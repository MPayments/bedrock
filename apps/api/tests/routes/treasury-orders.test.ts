import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TreasuryOrder } from "@bedrock/treasury/contracts";

import { treasuryOrdersRoutes } from "../../src/routes/treasury-orders";

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

function uuid(value: number) {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

const NOW = new Date("2026-04-24T10:00:00.000Z");

function createOrder(
  overrides: Partial<TreasuryOrder> = {},
  stepOverrides: Partial<TreasuryOrder["steps"][number]> = {},
): TreasuryOrder {
  return {
    activatedAt: null,
    cancelledAt: null,
    createdAt: NOW,
    description: "Treasury rebalance",
    id: uuid(501),
    state: "draft",
    steps: [
      {
        createdAt: NOW,
        fromAmountMinor: 10000n,
        fromCurrencyId: uuid(201),
        fromParty: {
          id: uuid(301),
          requisiteId: uuid(401),
        },
        id: uuid(601),
        kind: "internal_transfer",
        paymentStepId: null,
        quoteId: null,
        rate: null,
        sequence: 1,
        sourceRef: `treasury-order:${uuid(501)}:step:1:internal_transfer`,
        toAmountMinor: 10000n,
        toCurrencyId: uuid(201),
        toParty: {
          id: uuid(302),
          requisiteId: uuid(402),
        },
        updatedAt: NOW,
        ...stepOverrides,
      },
    ],
    type: "rebalance",
    updatedAt: NOW,
    ...overrides,
  };
}

function createTestApp() {
  const treasuryOrders = {
    commands: {
      activate: vi.fn(async () =>
        createOrder(
          {
            activatedAt: NOW,
            state: "active",
          },
          {
            paymentStepId: uuid(701),
          },
        ),
      ),
      cancel: vi.fn(async () =>
        createOrder({
          cancelledAt: NOW,
          state: "cancelled",
        }),
      ),
      create: vi.fn(async () => createOrder()),
    },
    queries: {
      findById: vi.fn(async () => createOrder()),
      list: vi.fn(async () => ({
        data: [createOrder()],
        limit: 50,
        offset: 0,
        total: 1,
      })),
    },
  };
  const createTreasuryModule = vi.fn(() => ({
    treasuryOrders,
  }));
  const withIdempotencyTx = vi.fn(async ({ handler }) => handler());
  const runInTransaction = vi.fn(async (run) => run({ id: "tx-1" }));
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role: "admin" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: c.req.header("idempotency-key") ?? null,
    });
    await next();
  });

  app.route(
    "/treasury/orders",
    treasuryOrdersRoutes({
      createTreasuryModule,
      idempotency: {
        withIdempotencyTx,
      },
      persistence: {
        runInTransaction,
      },
      treasuryModule: {
        treasuryOrders,
      },
    } as any),
  );

  return {
    app,
    createTreasuryModule,
    treasuryOrders,
    withIdempotencyTx,
  };
}

describe("treasury orders routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("creates a treasury order with idempotency", async () => {
    const { app, treasuryOrders, withIdempotencyTx } = createTestApp();

    const response = await app.request("http://localhost/treasury/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "treasury-order-create-1",
      },
      body: JSON.stringify({
        description: "Treasury rebalance",
        steps: [
          {
            fromAmountMinor: "10000",
            fromCurrencyId: uuid(201),
            fromParty: {
              id: uuid(301),
              requisiteId: uuid(401),
            },
            kind: "internal_transfer",
            toAmountMinor: "10000",
            toCurrencyId: uuid(201),
            toParty: {
              id: uuid(302),
              requisiteId: uuid(402),
            },
          },
        ],
        type: "rebalance",
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      description: "Treasury rebalance",
      state: "draft",
      steps: [
        {
          fromAmountMinor: "10000",
          kind: "internal_transfer",
          paymentStepId: null,
          toAmountMinor: "10000",
        },
      ],
      type: "rebalance",
    });
    expect(treasuryOrders.commands.create).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: [
          expect.objectContaining({
            fromAmountMinor: 10000n,
            kind: "internal_transfer",
            toAmountMinor: 10000n,
          }),
        ],
        type: "rebalance",
      }),
    );
    expect(withIdempotencyTx).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        idempotencyKey: "treasury-order-create-1",
        scope: "treasury.orders.create",
      }),
    );
  });

  it("activates an order and returns child payment step links", async () => {
    const { app, treasuryOrders } = createTestApp();

    const response = await app.request(
      `http://localhost/treasury/orders/${uuid(501)}/activate`,
      {
        method: "POST",
        headers: {
          "idempotency-key": "treasury-order-activate-1",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(treasuryOrders.commands.activate).toHaveBeenCalledWith({
      orderId: uuid(501),
    });
    await expect(response.json()).resolves.toMatchObject({
      activatedAt: NOW.toISOString(),
      state: "active",
      steps: [
        {
          paymentStepId: uuid(701),
        },
      ],
    });
  });

  it("lists treasury orders", async () => {
    const { app, treasuryOrders } = createTestApp();

    const response = await app.request(
      "http://localhost/treasury/orders?type=rebalance&state=draft",
    );

    expect(response.status).toBe(200);
    expect(treasuryOrders.queries.list).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      state: "draft",
      type: "rebalance",
    });
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: uuid(501),
          type: "rebalance",
        },
      ],
      total: 1,
    });
  });
});
