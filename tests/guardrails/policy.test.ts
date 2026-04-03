import { describe, expect, it } from "vitest";

import {
  isDbImportAllowed,
  isKindDependencyAllowed,
  isSchemaImportAllowed,
} from "../../scripts/guardrails/policy.mjs";

describe("guardrail policy", () => {
  it("keeps the package-kind dependency matrix aligned with the target architecture", () => {
    expect(isKindDependencyAllowed("module", "platform")).toBe(true);
    expect(isKindDependencyAllowed("sdk", "app")).toBe(false);
    expect(isKindDependencyAllowed("platform", "module")).toBe(false);
  });

  it("allows schema imports only from approved aggregation zones", () => {
    expect(
      isSchemaImportAllowed("@bedrock/currencies", "apps/db/src/bootstrap.ts"),
    ).toBe(true);
    expect(
      isSchemaImportAllowed(
        "@bedrock/treasury",
        "packages/plugins/documents-ifrs/src/infra/provider.ts",
      ),
    ).toBe(true);
    expect(
      isSchemaImportAllowed(
        "@bedrock/treasury",
        "packages/modules/treasury/src/module.ts",
      ),
    ).toBe(false);
    expect(
      isSchemaImportAllowed("@bedrock/parties", "apps/api/src/routes/deals.ts"),
    ).toBe(false);
    expect(
      isSchemaImportAllowed(
        "@bedrock/treasury",
        "apps/api/src/composition/deals-module.ts",
      ),
    ).toBe(false);
  });

  it("limits postgres client construction to apps, scripts, and integration tests", () => {
    expect(isDbImportAllowed("apps/api/src/db/client.ts")).toBe(true);
    expect(isDbImportAllowed("scripts/smoke/db-check.mjs")).toBe(true);
    expect(
      isDbImportAllowed(
        "packages/modules/ledger/tests/integration/client.test.ts",
      ),
    ).toBe(true);
    expect(isDbImportAllowed("packages/modules/ledger/src/service.ts")).toBe(
      false,
    );
  });
});
