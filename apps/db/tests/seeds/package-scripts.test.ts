import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

async function readPackageJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as {
    scripts?: Record<string, string>;
  };
}

describe("seed package scripts", () => {
  it("exposes explicit seed profiles and removes plain db:seed", async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const appPackage = await readPackageJson(resolve(here, "../../package.json"));
    const rootPackage = await readPackageJson(
      resolve(here, "../../../../package.json"),
    );

    for (const pkg of [appPackage, rootPackage]) {
      expect(pkg.scripts).toHaveProperty("db:seed:required");
      expect(pkg.scripts).toHaveProperty("db:seed:local");
      expect(pkg.scripts).toHaveProperty("db:seed:all");
      expect(pkg.scripts).not.toHaveProperty("db:seed");
    }
  });
});
