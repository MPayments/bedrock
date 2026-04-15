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

import { treasuryExecutionActualsRoutes } from "../../src/routes/treasury-execution-actuals";

function uuid(value: number) {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

function createExecutionFill(overrides: Record<string, unknown> = {}) {
  return {
    actualRateDen: null,
    actualRateNum: null,
    boughtAmountMinor: null,
    boughtCurrencyId: null,
    calculationSnapshotId: null,
    confirmedAt: new Date("2026-04-03T10:15:00.000Z"),
    createdAt: new Date("2026-04-03T10:10:00.000Z"),
    dealId: uuid(301),
    executedAt: new Date("2026-04-03T10:10:00.000Z"),
    externalRecordId: "statement:1",
    fillSequence: null,
    id: uuid(401),
    instructionId: uuid(501),
    metadata: { provider: "bank-a" },
    notes: "manual confirmation",
    operationId: uuid(101),
    providerCounterpartyId: null,
    providerRef: "provider-1",
    routeLegId: uuid(601),
    routeVersionId: null,
    soldAmountMinor: "9950",
    soldCurrencyId: uuid(201),
    sourceKind: "manual",
    sourceRef: `treasury-execution-fill:${uuid(101)}:idem-1`,
    updatedAt: new Date("2026-04-03T10:10:00.000Z"),
    ...overrides,
  };
}

function createCashMovement(overrides: Record<string, unknown> = {}) {
  return {
    accountRef: null,
    amountMinor: "9950",
    bookedAt: new Date("2026-04-03T10:10:00.000Z"),
    calculationSnapshotId: null,
    confirmedAt: null,
    createdAt: new Date("2026-04-03T10:10:00.000Z"),
    currencyId: uuid(201),
    dealId: uuid(301),
    direction: "debit",
    externalRecordId: "statement:1",
    id: uuid(701),
    instructionId: uuid(501),
    metadata: { provider: "bank-a" },
    notes: "manual confirmation",
    operationId: uuid(101),
    providerCounterpartyId: null,
    providerRef: "provider-1",
    requisiteId: null,
    routeLegId: uuid(601),
    routeVersionId: null,
    sourceKind: "manual",
    sourceRef: `treasury-cash-movement:${uuid(101)}:idem-1`,
    statementRef: null,
    updatedAt: new Date("2026-04-03T10:10:00.000Z"),
    valueDate: null,
    ...overrides,
  };
}

function createTestApp() {
  const listExecutionFills = vi.fn(async (input: any) => ({
    data: [
      createExecutionFill({
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
  const recordCashMovement = vi.fn(async (input: any) =>
    createCashMovement({
      amountMinor: input.amountMinor?.toString() ?? null,
      bookedAt: input.bookedAt ?? new Date("2026-04-03T10:10:00.000Z"),
      currencyId: input.currencyId ?? null,
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
    treasuryExecutionActualsRoutes({
      treasuryModule: {
        operations: {
          commands: {
            recordCashMovement,
          },
          queries: {
            listExecutionFills,
          },
        },
      },
    } as any),
  );

  return {
    app,
    listExecutionFills,
    recordCashMovement,
  };
}

describe("treasury execution actuals routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("lists execution fills filtered by deal, route leg, and source kind", async () => {
    const { app, listExecutionFills } = createTestApp();

    const response = await app.request(
      `http://localhost/treasury/execution-fills?dealId=${uuid(301)}&routeLegId=${uuid(601)}&sourceKind=manual&limit=10&offset=0`,
    );

    expect(response.status).toBe(200);
    expect(listExecutionFills).toHaveBeenCalledWith({
      dealId: uuid(301),
      limit: 10,
      offset: 0,
      operationId: undefined,
      routeLegId: uuid(601),
      sortBy: "executedAt",
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

  it("records a cash movement and derives sourceRef from idempotency", async () => {
    const { app, recordCashMovement } = createTestApp();

    const response = await app.request(
      `http://localhost/treasury/operations/${uuid(101)}/cash-movements`,
      {
        body: JSON.stringify({
          amountMinor: "9950",
          bookedAt: "2026-04-03T10:10:00.000Z",
          currencyId: uuid(201),
          direction: "debit",
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
    expect(recordCashMovement).toHaveBeenCalledWith({
      accountRef: null,
      amountMinor: 9950n,
      bookedAt: new Date("2026-04-03T10:10:00.000Z"),
      calculationSnapshotId: null,
      confirmedAt: null,
      currencyId: uuid(201),
      direction: "debit",
      externalRecordId: null,
      instructionId: null,
      metadata: null,
      notes: "manual confirmation",
      operationId: uuid(101),
      providerCounterpartyId: null,
      providerRef: null,
      requisiteId: null,
      routeLegId: uuid(601),
      routeVersionId: null,
      sourceKind: "manual",
      sourceRef: `treasury-cash-movement:${uuid(101)}:idem-1`,
      statementRef: null,
      valueDate: null,
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        amountMinor: "9950",
        operationId: uuid(101),
        routeLegId: uuid(601),
        sourceKind: "manual",
        sourceRef: `treasury-cash-movement:${uuid(101)}:idem-1`,
      }),
    );
  });
});
