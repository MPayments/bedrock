import { describe, expect, it, vi } from "vitest";

import { withRequiredIdempotency } from "../../src/middleware/idempotency";

function createContext(idempotencyKey: string | null) {
  return {
    get(key: "requestContext") {
      if (key !== "requestContext") {
        return undefined;
      }
      return {
        requestId: "req-1",
        correlationId: "corr-1",
        traceId: null,
        causationId: null,
        idempotencyKey,
      };
    },
    json(body: unknown, status?: number) {
      return new Response(JSON.stringify(body), {
        status: status ?? 200,
        headers: { "content-type": "application/json" },
      });
    },
  };
}

describe("withRequiredIdempotency", () => {
  it("returns 400 response when idempotency key is missing", async () => {
    const context = createContext(null);
    const run = vi.fn(async () => ({ ok: true }));

    const result = await withRequiredIdempotency(context, run);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing Idempotency-Key header",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("calls callback with idempotency key when present", async () => {
    const context = createContext("idem-1");
    const run = vi.fn(async (idempotencyKey: string) => ({
      idempotencyKey,
    }));

    const result = await withRequiredIdempotency(context, run);

    expect(result).toEqual({ idempotencyKey: "idem-1" });
    expect(run).toHaveBeenCalledWith("idem-1");
  });
});
