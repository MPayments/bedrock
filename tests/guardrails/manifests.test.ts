import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { collectManifestProblems } from "../../scripts/check-manifests.mjs";

function writeJson(filePath, value) {
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

describe("manifest guardrails", () => {
  it("flags missing exports, internal exports, non-workspace protocols, undeclared deps, and deep imports", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "bedrock-guardrails-"));

    mkdirSync(join(rootDir, "packages", "shared", "src"), { recursive: true });
    mkdirSync(
      join(rootDir, "packages", "modules", "example", "src", "internal"),
      {
        recursive: true,
      },
    );
    mkdirSync(join(rootDir, "packages", "modules", "extra", "src"), {
      recursive: true,
    });
    mkdirSync(join(rootDir, "packages", "modules", "noexports", "src"), {
      recursive: true,
    });

    writeJson(join(rootDir, "package.json"), {
      private: true,
      workspaces: ["packages/shared", "packages/modules/*"],
    });

    writeJson(join(rootDir, "packages", "shared", "package.json"), {
      name: "@bedrock/shared",
      private: true,
      type: "module",
      exports: {
        ".": "./src/index.ts",
      },
      bedrock: { kind: "shared" },
    });
    writeFileSync(
      join(rootDir, "packages", "shared", "src", "index.ts"),
      "export const shared = 1;\n",
    );

    writeJson(join(rootDir, "packages", "modules", "extra", "package.json"), {
      name: "@bedrock/extra",
      private: true,
      type: "module",
      exports: {
        ".": "./src/index.ts",
      },
      bedrock: { kind: "module" },
    });
    writeFileSync(
      join(rootDir, "packages", "modules", "extra", "src", "index.ts"),
      "export const extra = 1;\n",
    );

    writeJson(join(rootDir, "packages", "modules", "example", "package.json"), {
      name: "@bedrock/example",
      private: true,
      type: "module",
      exports: {
        ".": "./src/index.ts",
        "./internal": "./src/internal/index.ts",
      },
      dependencies: {
        "@bedrock/shared": "*",
      },
      bedrock: { kind: "module" },
    });
    writeFileSync(
      join(rootDir, "packages", "modules", "example", "src", "index.ts"),
      [
        'import { shared } from "@bedrock/shared";',
        'import { extra } from "@bedrock/extra";',
        'import { hidden } from "@bedrock/shared/private";',
        "",
        "export const value = shared + extra + Number(Boolean(hidden));",
      ].join("\n"),
    );
    writeFileSync(
      join(
        rootDir,
        "packages",
        "modules",
        "example",
        "src",
        "internal",
        "index.ts",
      ),
      "export const hidden = 1;\n",
    );

    writeJson(
      join(rootDir, "packages", "modules", "noexports", "package.json"),
      {
        name: "@bedrock/noexports",
        private: true,
        type: "module",
        bedrock: { kind: "module" },
      },
    );
    writeFileSync(
      join(rootDir, "packages", "modules", "noexports", "src", "index.ts"),
      "export const missing = true;\n",
    );

    const problems = collectManifestProblems(rootDir);
    const problemTypes = problems.map((problem) => problem.type);

    expect(problemTypes).toContain("missing-exports");
    expect(problemTypes).toContain("internal-export");
    expect(problemTypes).toContain("non-workspace-protocol");
    expect(problemTypes).toContain("undeclared-workspace-dependency");
    expect(problemTypes).toContain("non-exported-subpath");
  });

  it("flags cross-package relative imports precisely", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "bedrock-guardrails-relative-"));

    mkdirSync(join(rootDir, "packages", "shared", "src"), { recursive: true });
    mkdirSync(join(rootDir, "packages", "modules", "example", "src"), {
      recursive: true,
    });

    writeJson(join(rootDir, "package.json"), {
      private: true,
      workspaces: ["packages/shared", "packages/modules/*"],
    });

    writeJson(join(rootDir, "packages", "shared", "package.json"), {
      name: "@bedrock/shared",
      private: true,
      type: "module",
      exports: { ".": "./src/index.ts" },
      bedrock: { kind: "shared" },
    });
    writeFileSync(
      join(rootDir, "packages", "shared", "src", "index.ts"),
      "export const shared = 1;\n",
    );

    writeJson(join(rootDir, "packages", "modules", "example", "package.json"), {
      name: "@bedrock/example",
      private: true,
      type: "module",
      exports: { ".": "./src/index.ts" },
      bedrock: { kind: "module" },
    });
    writeFileSync(
      join(rootDir, "packages", "modules", "example", "src", "index.ts"),
      'export { shared } from "../../../shared/src/index";\n',
    );

    const problems = collectManifestProblems(rootDir);

    expect(
      problems.some(
        (problem) => problem.type === "cross-package-relative-import",
      ),
    ).toBe(true);
  });
});
