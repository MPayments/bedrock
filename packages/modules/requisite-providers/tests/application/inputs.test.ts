import { describe, expect, it } from "vitest";

import { resolveRequisiteProviderUpdateInput } from "../../src/application/providers/inputs";

describe("requisite provider inputs", () => {
  it("resolves provider patches without leaving undefined fields", () => {
    expect(
      resolveRequisiteProviderUpdateInput(
        {
          id: "provider-1",
          kind: "bank",
          name: "Core Bank",
          description: null,
          country: "RU",
          address: null,
          contact: null,
          bic: "044525225",
          swift: null,
          archivedAt: null,
          createdAt: new Date("2026-03-15T00:00:00.000Z"),
          updatedAt: new Date("2026-03-15T00:00:00.000Z"),
        },
        {
          name: "Updated Bank",
        },
      ),
    ).toEqual({
      kind: "bank",
      name: "Updated Bank",
      description: null,
      country: "RU",
      address: null,
      contact: null,
      bic: "044525225",
      swift: null,
    });
  });
});
