import { describe, expect, it } from "vitest";

process.env.BETTER_AUTH_SECRET ??= "test-secret";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_BASE_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_TRUSTED_ORIGINS ??= "http://localhost:3000";

const { API_ROUTE_MOUNTS, listApiRouteMounts } = await import(
  "../../src/runtime"
);

describe("API route registry", () => {
  it("keeps route ids unique", () => {
    const routeIds = API_ROUTE_MOUNTS.map((routeMount) => routeMount.id);
    expect(new Set(routeIds).size).toBe(routeIds.length);
  });

  it("keeps route paths unique and excludes removed system routes", () => {
    const routePaths = listApiRouteMounts().map((routeMount) => routeMount.routePath);
    expect(new Set(routePaths).size).toBe(routePaths.length);
    expect(routePaths).not.toContain("/system/modules");
  });
});
