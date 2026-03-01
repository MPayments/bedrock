import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import { createModuleGuard } from "../../src/middleware/module-guard";

function createContextStub(disabled: boolean) {
  return {
    moduleRuntime: {
      getEffectiveState: vi.fn(async () => ({
        moduleId: "payments",
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

describe("createModuleGuard", () => {
  it("returns 503 with Retry-After when module is disabled", async () => {
    const app = new OpenAPIHono();
    app.use("*", createModuleGuard(createContextStub(true), "payments"));
    app.get("/", (c) => c.json({ ok: true }));

    const response = await app.request("http://localhost/");

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("120");
    await expect(response.json()).resolves.toMatchObject({
      code: "MODULE_DISABLED",
      moduleId: "payments",
      retryAfterSec: 120,
    });
  });

  it("allows request when module is enabled", async () => {
    const app = new OpenAPIHono();
    app.use("*", createModuleGuard(createContextStub(false), "payments"));
    app.get("/", (c) => c.json({ ok: true }));

    const response = await app.request("http://localhost/");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
