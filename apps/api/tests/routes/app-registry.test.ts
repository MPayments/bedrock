import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("app route registry", () => {
  it("does not mount the removed activity projection route", () => {
    const appSource = readFileSync(
      new URL("../../src/app.ts", import.meta.url),
      "utf8",
    );
    const routesIndexSource = readFileSync(
      new URL("../../src/routes/index.ts", import.meta.url),
      "utf8",
    );

    expect(appSource).not.toContain('.route("/activity"');
    expect(routesIndexSource).not.toContain('activityRoutes');
  });
});
