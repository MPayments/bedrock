import { describe, expect, it } from "vitest";

import { RequisiteProvider } from "../../src/domain/requisite-provider";

describe("requisite provider inputs", () => {
  it("applies provider patches without leaving undefined fields", () => {
    const updated = RequisiteProvider.fromSnapshot({
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
    })
      .update({
        name: "Updated Bank",
        now: new Date("2026-03-16T00:00:00.000Z"),
      })
      .toSnapshot();

    expect(updated).toMatchObject({
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
