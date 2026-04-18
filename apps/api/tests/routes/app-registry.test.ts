import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("app route registry", () => {
  it("does not mount the removed activity and agents routes", () => {
    const appSource = readFileSync(
      new URL("../../src/app.ts", import.meta.url),
      "utf8",
    );
    const routesIndexSource = readFileSync(
      new URL("../../src/routes/index.ts", import.meta.url),
      "utf8",
    );

    expect(appSource).not.toContain('.route("/activity"');
    expect(appSource).not.toContain('.route("/agents"');
    expect(routesIndexSource).not.toContain('activityRoutes');
    expect(routesIndexSource).not.toContain("agentsRoutes");
  });
});
