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

import { treasuryOperationFactsRoutes } from "../../src/routes/treasury-operation-facts";

function uuid(value: number) {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

function createFact(overrides: Record<string, unknown> = {}) {
  return {
    amountMinor: "9950",
    confirmedAt: new Date("2026-04-03T10:15:00.000Z"),
    counterAmountMinor: null,
    counterCurrencyId: null,
    createdAt: new Date("2026-04-03T10:10:00.000Z"),
    currencyId: uuid(201),
    dealId: uuid(301),
    externalRecordId: "statement:1",
    feeAmountMinor: "50",
    feeCurrencyId: uuid(201),
    id: uuid(401),
    instructionId: uuid(501),
    metadata: { provider: "bank-a" },
    notes: "manual confirmation",
    operationId: uuid(101),
    providerRef: "provider-1",
    recordedAt: new Date("2026-04-03T10:10:00.000Z"),
    routeLegId: uuid(601),
    sourceKind: "manual",
    sourceRef: `treasury-operation-fact:${uuid(101)}:idem-1`,
    updatedAt: new Date("2026-04-03T10:10:00.000Z"),
    ...overrides,
  };
}

function createTestApp() {
  const listFacts = vi.fn(async (input: any) => ({
    data: [
      createFact({
        dealId: input.dealId ?? uuid(301),
        operationId: input.operationId ?? uuid(101),
        routeLegId: input.routeLegId ?? uuid(601),
        sourceKind: input.sourceKind?.[0] ?? "manual",
      }),
    ],
    limit: input.limit,
    offset: input.offset,
    total: 1,
  }));
  const recordActualFact = vi.fn(async (input: any) =>
    createFact({
      amountMinor: input.amountMinor?.toString() ?? null,
      counterAmountMinor: input.counterAmountMinor?.toString() ?? null,
      feeAmountMinor: input.feeAmountMinor?.toString() ?? null,
      operationId: input.operationId,
      routeLegId: input.routeLegId ?? uuid(601),
      sourceKind: input.sourceKind,
      sourceRef: input.sourceRef,
    }),
  );
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
    "/treasury",
    treasuryOperationFactsRoutes({
      treasuryModule: {
        operations: {
          commands: {
            recordActualFact,
          },
          queries: {
            listFacts,
          },
        },
      },
    } as any),
  );

  return {
    app,
    listFacts,
    recordActualFact,
  };
}

describe("treasury operation facts routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("lists facts filtered by deal, route leg, and source kind", async () => {
    const { app, listFacts } = createTestApp();

    const response = await app.request(
      `http://localhost/treasury/operation-facts?dealId=${uuid(301)}&routeLegId=${uuid(601)}&sourceKind=manual&limit=10&offset=0`,
    );

    expect(response.status).toBe(200);
    expect(listFacts).toHaveBeenCalledWith({
      dealId: uuid(301),
      limit: 10,
      offset: 0,
      operationId: undefined,
      routeLegId: uuid(601),
      sortBy: "recordedAt",
      sortOrder: "desc",
      sourceKind: ["manual"],
    });
    await expect(response.json()).resolves.toEqual({
      data: [
        expect.objectContaining({
          dealId: uuid(301),
          routeLegId: uuid(601),
          sourceKind: "manual",
        }),
      ],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });

  it("records an operation fact and derives sourceRef from idempotency", async () => {
    const { app, recordActualFact } = createTestApp();

    const response = await app.request(
      `http://localhost/treasury/operations/${uuid(101)}/facts`,
      {
        body: JSON.stringify({
          amountMinor: "9950",
          feeAmountMinor: "50",
          feeCurrencyId: uuid(201),
          notes: "manual confirmation",
          routeLegId: uuid(601),
          sourceKind: "manual",
        }),
        headers: {
          "content-type": "application/json",
          "idempotency-key": "idem-1",
        },
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
    expect(recordActualFact).toHaveBeenCalledWith({
      amountMinor: 9950n,
      confirmedAt: null,
      counterAmountMinor: null,
      counterCurrencyId: null,
      currencyId: null,
      externalRecordId: null,
      feeAmountMinor: 50n,
      feeCurrencyId: uuid(201),
      instructionId: null,
      metadata: null,
      notes: "manual confirmation",
      operationId: uuid(101),
      providerRef: null,
      recordedAt: null,
      routeLegId: uuid(601),
      sourceKind: "manual",
      sourceRef: `treasury-operation-fact:${uuid(101)}:idem-1`,
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        amountMinor: "9950",
        feeAmountMinor: "50",
        operationId: uuid(101),
        routeLegId: uuid(601),
        sourceKind: "manual",
        sourceRef: `treasury-operation-fact:${uuid(101)}:idem-1`,
      }),
    );
  });
});
