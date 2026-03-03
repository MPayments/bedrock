import { describe, expect, it } from "vitest";

import { jsonOk, toApiJson } from "../../src/common/response";

describe("response helpers", () => {
  it("serializes json-safe payloads and normalizes money fields", () => {
    const payload = {
      amountMinor: "1250",
      currency: "USD",
      nested: {
        revenueMinor: 900n,
        expenseMinor: 300n,
        netMinor: 600n,
        currency: "USD",
      },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    expect(toApiJson(payload, { normalizeMoney: true })).toEqual({
      amount: "12.5",
      currency: "USD",
      nested: {
        revenue: "9",
        expense: "3",
        net: "6",
        currency: "USD",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns a response with requested status via jsonOk", async () => {
    const c = {
      json(body: unknown, status?: number) {
        return new Response(JSON.stringify(body), {
          status: status ?? 200,
          headers: { "content-type": "application/json" },
        });
      },
    };

    const response = jsonOk(c, { amountMinor: "100" }, 201, {
      normalizeMoney: true,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ amount: "1" });
  });
});
