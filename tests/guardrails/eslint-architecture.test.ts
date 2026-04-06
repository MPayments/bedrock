import { mkdtempSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(
  __dirname,
  "../../scripts/guardrails/eslint.architecture.config.mjs",
);

async function lintText(relativePath, code) {
  const cwd = mkdtempSync(join(tmpdir(), "bedrock-eslint-"));
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: CONFIG_PATH,
  });

  return eslint.lintText(code, { filePath: join(cwd, relativePath) });
}

describe("architecture eslint", () => {
  it("forbids pgTable declarations outside schema files", async () => {
    const [result] = await lintText(
      "packages/modules/demo/src/service.ts",
      [
        'import { pgTable } from "drizzle-orm";',
        "",
        'export const table = pgTable("demo", {});',
      ].join("\n"),
    );

    expect(
      result.messages.some(
        (message) => message.ruleId === "no-restricted-syntax",
      ),
    ).toBe(true);
  }, 15_000);

  it("keeps accounting domain and ports free of forbidden imports", async () => {
    const [domainResult] = await lintText(
      "packages/modules/accounting/src/domain/example.ts",
      'import { pgTable } from "drizzle-orm";\n',
    );
    const [portsResult] = await lintText(
      "packages/modules/accounting/src/application/chart/ports.ts",
      'import "../schema";\n',
    );

    expect(
      domainResult.messages.some(
        (message) => message.ruleId === "no-restricted-imports",
      ),
    ).toBe(true);
    expect(
      portsResult.messages.some(
        (message) => message.ruleId === "no-restricted-imports",
      ),
    ).toBe(true);
  });

  it("allows pgTable declarations in schema files", async () => {
    const [result] = await lintText(
      "packages/modules/demo/src/infra/drizzle/schema.ts",
      [
        'import { pgTable } from "drizzle-orm";',
        "",
        'export const table = pgTable("demo", {});',
      ].join("\n"),
    );

    expect(result.messages).toHaveLength(0);
  });
});
