import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("application workflows composition", () => {
  it("does not import deleted sync workflow packages", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../../src/composition/workflows.ts"),
      "utf8",
    );

    expect(source).not.toContain("@bedrock/workflow-customer-portal");
    expect(source).not.toContain("@bedrock/workflow-document-drafts");
    expect(source).not.toContain("@bedrock/workflow-document-generation");
    expect(source).not.toContain("@bedrock/workflow-organization-bootstrap");
    expect(source).not.toContain("@bedrock/workflow-requisite-accounting");
  });
});
