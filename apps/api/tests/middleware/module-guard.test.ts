import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import { createComponentGuard } from "../../src/middleware/module-guard";

function createContextStub(disabled: boolean) {
  return {
    componentRuntime: {
      getEffectiveComponentState: vi.fn(async () => ({
        componentId: "payments",
        state: disabled ? "disabled" : "enabled",
        source: disabled ? "global" : "default",
        reason: disabled ? "maintenance" : "enabled by default",
        retryAfterSec: 120,
        scope: { scopeType: "global", scopeId: "__global__" },
        dependencyChain: ["payments"],
        manifestVersion: 1,
      })),
    },
  } as any;
}

describe("createComponentGuard", () => {
  it("returns 503 with Retry-After when component is disabled", async () => {
    const app = new OpenAPIHono();
    app.use("*", createComponentGuard(createContextStub(true), "payments"));
    app.get("/", (c) => c.json({ ok: true }));

    const response = await app.request("http://localhost/");

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("120");
    await expect(response.json()).resolves.toMatchObject({
      code: "COMPONENT_DISABLED",
      componentId: "payments",
      retryAfterSec: 120,
    });
  });

  it("allows request when component is enabled", async () => {
    const app = new OpenAPIHono();
    app.use("*", createComponentGuard(createContextStub(false), "payments"));
    app.get("/", (c) => c.json({ ok: true }));

    const response = await app.request("http://localhost/");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
