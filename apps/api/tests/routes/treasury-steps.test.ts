import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentStepNotFoundError } from "@bedrock/treasury";
import type { PaymentStep } from "@bedrock/treasury/contracts";

import { treasuryStepsRoutes } from "../../src/routes/treasury-steps";

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

function createAttempt(overrides: Partial<PaymentStep["attempts"][number]> = {}) {
  return {
    attemptNo: 1,
    createdAt: NOW,
    id: uuid(901),
    outcome: "pending" as const,
    outcomeAt: null,
    paymentStepId: uuid(101),
    providerRef: "provider-1",
    providerSnapshot: { status: "submitted" },
    submittedAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createStep(overrides: Partial<PaymentStep> = {}): PaymentStep {
  return {
    amendments: [],
    artifacts: [],
    attempts: [],
    completedAt: null,
    createdAt: NOW,
    currentRoute: {
      fromAmountMinor: 10000n,
      fromCurrencyId: uuid(201),
      fromParty: {
        id: uuid(301),
        requisiteId: uuid(401),
      },
      rate: null,
      toAmountMinor: 9200n,
      toCurrencyId: uuid(202),
      toParty: {
        id: uuid(302),
        requisiteId: uuid(402),
      },
    },
    dealId: null,
    failureReason: null,
    fromAmountMinor: 10000n,
    fromCurrencyId: uuid(201),
    fromParty: {
      id: uuid(301),
      requisiteId: uuid(401),
    },
    id: uuid(101),
    kind: "payout",
    origin: {
      dealId: null,
      planLegId: null,
      routeSnapshotLegId: null,
      sequence: null,
      treasuryOrderId: null,
      type: "manual",
    },
    plannedRoute: {
      fromAmountMinor: 10000n,
      fromCurrencyId: uuid(201),
      fromParty: {
        id: uuid(301),
        requisiteId: uuid(401),
      },
      rate: null,
      toAmountMinor: 9200n,
      toCurrencyId: uuid(202),
      toParty: {
        id: uuid(302),
        requisiteId: uuid(402),
      },
    },
    postingDocumentRefs: [],
    purpose: "standalone_payment",
    quoteId: null,
    rate: null,
    returns: [],
    scheduledAt: null,
    sourceRef: "manual:step-1",
    state: "draft",
    submittedAt: null,
    toAmountMinor: 9200n,
    toCurrencyId: uuid(202),
    toParty: {
      id: uuid(302),
      requisiteId: uuid(402),
    },
    treasuryBatchId: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function createTestApp() {
  const paymentSteps = {
    commands: {
      amend: vi.fn(async () =>
        createStep({
          fromAmountMinor: 12000n,
          rate: {
            lockedSide: "in",
            value: "1.08695652",
          },
          state: "pending",
        }),
      ),
      cancel: vi.fn(async () => createStep({ state: "cancelled" })),
      confirm: vi.fn(async () =>
        createStep({
          attempts: [
            createAttempt({
              outcome: "settled",
              outcomeAt: NOW,
            }),
          ],
          completedAt: NOW,
          state: "completed",
        }),
      ),
      create: vi.fn(async () => createStep()),
      skip: vi.fn(async () => createStep({ state: "skipped" })),
      submit: vi.fn(async () =>
        createStep({
          attempts: [createAttempt()],
          state: "processing",
          submittedAt: NOW,
        }),
      ),
    },
    queries: {
      findById: vi.fn(async () => createStep()),
      list: vi.fn(async () => ({
        data: [
          createStep({ id: uuid(101), state: "pending" }),
          createStep({ id: uuid(102), state: "failed" }),
        ],
        limit: 2,
        offset: 1,
        total: 8,
      })),
    },
  };
  const createTreasuryModule = vi.fn(() => ({
    paymentSteps,
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
    "/treasury/steps",
    treasuryStepsRoutes({
      createTreasuryModule,
      idempotency: {
        withIdempotencyTx,
      },
      persistence: {
        runInTransaction,
      },
      treasuryModule: {
        paymentSteps,
      },
    } as any),
  );

  return {
    app,
    createTreasuryModule,
    paymentSteps,
    runInTransaction,
    withIdempotencyTx,
  };
}

describe("treasury steps routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("creates a standalone payment step with idempotency", async () => {
    const { app, paymentSteps, withIdempotencyTx } = createTestApp();

    const response = await app.request("http://localhost/treasury/steps", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "step-create-1",
      },
      body: JSON.stringify({
        fromAmountMinor: "10000",
        fromCurrencyId: uuid(201),
        fromParty: {
          id: uuid(301),
          requisiteId: uuid(401),
        },
        kind: "payout",
        toAmountMinor: "9200",
        toCurrencyId: uuid(202),
        toParty: {
          id: uuid(302),
          requisiteId: uuid(402),
        },
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      createdAt: NOW.toISOString(),
      fromAmountMinor: "10000",
      purpose: "standalone_payment",
      state: "draft",
      toAmountMinor: "9200",
    });
    expect(paymentSteps.commands.create).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: null,
        fromAmountMinor: 10000n,
        purpose: "standalone_payment",
        toAmountMinor: 9200n,
        treasuryBatchId: null,
      }),
    );
    expect(withIdempotencyTx).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        idempotencyKey: "step-create-1",
        scope: "treasury.payment_steps.create",
      }),
    );
  });

  it("lists payment steps with filters and serializes amounts", async () => {
    const { app, paymentSteps } = createTestApp();

    const response = await app.request(
      "http://localhost/treasury/steps?purpose=standalone_payment&state=pending&state=failed&limit=2&offset=1",
    );

    expect(response.status).toBe(200);
    expect(paymentSteps.queries.list).toHaveBeenCalledWith({
      batchId: undefined,
      dealId: undefined,
      limit: 2,
      offset: 1,
      purpose: "standalone_payment",
      state: ["pending", "failed"],
    });
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          fromAmountMinor: "10000",
          id: uuid(101),
          state: "pending",
          toAmountMinor: "9200",
        },
        {
          id: uuid(102),
          state: "failed",
        },
      ],
      limit: 2,
      offset: 1,
      total: 8,
    });
  });

  it("returns a payment step by id", async () => {
    const { app, paymentSteps } = createTestApp();

    const response = await app.request(
      `http://localhost/treasury/steps/${uuid(101)}`,
    );

    expect(response.status).toBe(200);
    expect(paymentSteps.queries.findById).toHaveBeenCalledWith({
      stepId: uuid(101),
    });
    await expect(response.json()).resolves.toMatchObject({
      id: uuid(101),
      fromAmountMinor: "10000",
    });
  });

  it("returns 404 for unknown payment steps", async () => {
    const { app, paymentSteps } = createTestApp();
    paymentSteps.queries.findById.mockRejectedValueOnce(
      new PaymentStepNotFoundError(uuid(999)),
    );

    const response = await app.request(
      `http://localhost/treasury/steps/${uuid(999)}`,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: `Payment step not found: ${uuid(999)}`,
    });
  });

  it("submits and confirms payment steps", async () => {
    const { app, paymentSteps } = createTestApp();

    const submitResponse = await app.request(
      `http://localhost/treasury/steps/${uuid(101)}/submit`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "step-submit-1",
        },
        body: JSON.stringify({
          attemptId: uuid(901),
          providerRef: "provider-1",
          providerSnapshot: { status: "submitted" },
        }),
      },
    );
    const confirmResponse = await app.request(
      `http://localhost/treasury/steps/${uuid(101)}/confirm`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "step-confirm-1",
        },
        body: JSON.stringify({
          artifacts: [
            {
              fileAssetId: uuid(801),
              purpose: "bank_confirmation",
            },
          ],
          outcome: "settled",
        }),
      },
    );

    expect(submitResponse.status).toBe(200);
    expect(confirmResponse.status).toBe(200);
    expect(paymentSteps.commands.submit).toHaveBeenCalledWith({
      attemptId: uuid(901),
      providerRef: "provider-1",
      providerSnapshot: { status: "submitted" },
      stepId: uuid(101),
    });
    expect(paymentSteps.commands.confirm).toHaveBeenCalledWith({
      artifacts: [
        {
          fileAssetId: uuid(801),
          purpose: "bank_confirmation",
        },
      ],
      failureReason: null,
      outcome: "settled",
      stepId: uuid(101),
    });
    await expect(submitResponse.json()).resolves.toMatchObject({
      attempts: [
        {
          id: uuid(901),
          submittedAt: NOW.toISOString(),
        },
      ],
      state: "processing",
    });
    await expect(confirmResponse.json()).resolves.toMatchObject({
      completedAt: NOW.toISOString(),
      state: "completed",
    });
  });

  it("amends, cancels, and skips payment steps", async () => {
    const { app, paymentSteps } = createTestApp();

    const amendResponse = await app.request(
      `http://localhost/treasury/steps/${uuid(101)}/amend`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "step-amend-1",
        },
        body: JSON.stringify({
          fromAmountMinor: "12000",
          rate: {
            lockedSide: "in",
            value: "1.08695652",
          },
        }),
      },
    );
    const cancelResponse = await app.request(
      `http://localhost/treasury/steps/${uuid(101)}/cancel`,
      {
        method: "POST",
        headers: {
          "idempotency-key": "step-cancel-1",
        },
      },
    );
    const skipResponse = await app.request(
      `http://localhost/treasury/steps/${uuid(101)}/skip`,
      {
        method: "POST",
        headers: {
          "idempotency-key": "step-skip-1",
        },
      },
    );

    expect(amendResponse.status).toBe(200);
    expect(cancelResponse.status).toBe(200);
    expect(skipResponse.status).toBe(200);
    expect(paymentSteps.commands.amend).toHaveBeenCalledWith({
      fromAmountMinor: 12000n,
      rate: {
        lockedSide: "in",
        value: "1.08695652",
      },
      stepId: uuid(101),
    });
    expect(paymentSteps.commands.cancel).toHaveBeenCalledWith({
      stepId: uuid(101),
    });
    expect(paymentSteps.commands.skip).toHaveBeenCalledWith({
      stepId: uuid(101),
    });
    await expect(amendResponse.json()).resolves.toMatchObject({
      fromAmountMinor: "12000",
      state: "pending",
    });
    await expect(cancelResponse.json()).resolves.toMatchObject({
      state: "cancelled",
    });
    await expect(skipResponse.json()).resolves.toMatchObject({
      state: "skipped",
    });
  });

  it("requires idempotency for payment step mutations", async () => {
    const { app, paymentSteps } = createTestApp();

    const response = await app.request(
      `http://localhost/treasury/steps/${uuid(101)}/cancel`,
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing Idempotency-Key header",
    });
    expect(paymentSteps.commands.cancel).not.toHaveBeenCalled();
  });
});
