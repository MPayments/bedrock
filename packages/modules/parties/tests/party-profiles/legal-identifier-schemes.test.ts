import { describe, expect, it } from "vitest";

import { ValidationError } from "@bedrock/shared/core/errors";

import { assertUniqueLegalIdentifierSchemes } from "../../src/party-profiles/domain/legal-identifier-schemes";

describe("legal identifier scheme rules", () => {
  it("allows unique schemes", () => {
    expect(() =>
      assertUniqueLegalIdentifierSchemes([
        { scheme: "inn" },
        { scheme: "kpp" },
      ]),
    ).not.toThrow();
  });

  it("rejects duplicate schemes", () => {
    expect(() =>
      assertUniqueLegalIdentifierSchemes([
        { scheme: "inn" },
        { scheme: "inn" },
      ]),
    ).toThrow(ValidationError);
  });
});
