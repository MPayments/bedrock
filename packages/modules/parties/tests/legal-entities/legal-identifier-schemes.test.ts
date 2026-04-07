import { ValidationError } from "@bedrock/shared/core/errors";
import { describe, expect, it } from "vitest";

import { assertUniqueLegalIdentifierSchemes } from "../../src/legal-entities/domain/legal-identifier-schemes";

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
