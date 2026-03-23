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

import { balancesRoutes } from "../../src/routes/balances";

function createLedgerModuleStub() {
  return {
    balances: {
      commands: {
        reserve: vi.fn(),
        release: vi.fn(),
        consume: vi.fn(),
      },
      queries: {
        getBalance: vi.fn(),
      },
    },
  };
}

function createMutationResult() {
  const now = new Date("2026-03-01T00:00:00.000Z");

  return {
    balance: {
      bookId: "11111111-1111-4111-8111-111111111111",
      subjectType: "counterparty",
      subjectId: "cp-1",
      currency: "USD",
      ledgerBalance: 1000n,
      available: 900n,
      reserved: 100n,
      pending: 0n,
      version: 1,
    },
    hold: {
      id: "hold-1",
      holdRef: "hold-ref-1",
      amountMinor: 100n,
      state: "reserved",
      reason: "test",
      createdAt: now,
      releasedAt: null,
      consumedAt: null,
    },
  };
}

function createTestApp(requestIdempotencyKey: string | null = "idem-1") {
  const ledgerModule = createLedgerModuleStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: requestIdempotencyKey,
    } as any);
    await next();
  });
  app.route("/", balancesRoutes({ ledgerModule } as any));

  return { app, ledgerModule };
}

describe("balancesRoutes mutation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("returns 400 for mutations when idempotency header is missing", async () => {
    const { app, ledgerModule } = createTestApp(null);
    const mutationBodies = [
      {
        path: "/reserve",
        body: {
          subject: {
            bookId: "11111111-1111-4111-8111-111111111111",
            subjectType: "counterparty",
            subjectId: "cp-1",
            currency: "USD",
          },
          amount: "1.00",
          holdRef: "hold-ref-1",
        },
      },
      {
        path: "/release",
        body: {
          subject: {
            bookId: "11111111-1111-4111-8111-111111111111",
            subjectType: "counterparty",
            subjectId: "cp-1",
            currency: "USD",
          },
          holdRef: "hold-ref-1",
        },
      },
      {
        path: "/consume",
        body: {
          subject: {
            bookId: "11111111-1111-4111-8111-111111111111",
            subjectType: "counterparty",
            subjectId: "cp-1",
            currency: "USD",
          },
          holdRef: "hold-ref-1",
        },
      },
    ] as const;

    for (const mutation of mutationBodies) {
      const response = await app.request(`http://localhost${mutation.path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(mutation.body),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Missing Idempotency-Key header",
      });
    }

    expect(ledgerModule.balances.commands.reserve).not.toHaveBeenCalled();
    expect(ledgerModule.balances.commands.release).not.toHaveBeenCalled();
    expect(ledgerModule.balances.commands.consume).not.toHaveBeenCalled();
  });

  it("routes reserve/release/consume through shared mutation helper", async () => {
    const { app, ledgerModule } = createTestApp("idem-1");
    const mutationResult = createMutationResult();
    ledgerModule.balances.commands.reserve.mockResolvedValueOnce(mutationResult);
    ledgerModule.balances.commands.release.mockResolvedValueOnce(mutationResult);
    ledgerModule.balances.commands.consume.mockResolvedValueOnce(mutationResult);

    const commonBody = {
      subject: {
        bookId: "11111111-1111-4111-8111-111111111111",
        subjectType: "counterparty",
        subjectId: "cp-1",
        currency: "USD",
      },
      holdRef: "hold-ref-1",
      reason: "test",
    };

    const reserveResponse = await app.request("http://localhost/reserve", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...commonBody,
        amount: "1.00",
      }),
    });
    const releaseResponse = await app.request("http://localhost/release", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(commonBody),
    });
    const consumeResponse = await app.request("http://localhost/consume", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(commonBody),
    });

    expect(reserveResponse.status).toBe(200);
    expect(releaseResponse.status).toBe(200);
    expect(consumeResponse.status).toBe(200);

    expect(ledgerModule.balances.commands.reserve).toHaveBeenCalledWith({
      subject: commonBody.subject,
      amount: "1.00",
      holdRef: "hold-ref-1",
      reason: "test",
      actorId: "user-1",
      idempotencyKey: "idem-1",
      requestContext: expect.objectContaining({
        requestId: "req-1",
        correlationId: "corr-1",
      }),
    });
    expect(ledgerModule.balances.commands.release).toHaveBeenCalledWith({
      subject: commonBody.subject,
      holdRef: "hold-ref-1",
      reason: "test",
      actorId: "user-1",
      idempotencyKey: "idem-1",
      requestContext: expect.objectContaining({
        requestId: "req-1",
        correlationId: "corr-1",
      }),
    });
    expect(ledgerModule.balances.commands.consume).toHaveBeenCalledWith({
      subject: commonBody.subject,
      holdRef: "hold-ref-1",
      reason: "test",
      actorId: "user-1",
      idempotencyKey: "idem-1",
      requestContext: expect.objectContaining({
        requestId: "req-1",
        correlationId: "corr-1",
      }),
    });
  });
});
