import { describe, expect, it } from "vitest";

import { DomainError } from "@bedrock/shared/core/domain";

import {
  createRequisiteProviderSnapshot,
  updateRequisiteProviderSnapshot,
} from "../../src/requisites/domain/requisite-provider";

describe("requisite provider domain helpers", () => {
  it("normalizes provider snapshots", () => {
    const created = createRequisiteProviderSnapshot({
      id: "00000000-0000-4000-8000-000000000111",
      now: new Date("2026-01-01T00:00:00.000Z"),
      kind: "bank",
      legalName: "  JPM Chase Bank  ",
      displayName: "  JPM  ",
      description: "   ",
      country: "us",
      website: null,
    });

    expect(created.legalName).toBe("JPM Chase Bank");
    expect(created.displayName).toBe("JPM");
    expect(created.country).toBe("US");
    expect(created.description).toBeNull();

    const updated = updateRequisiteProviderSnapshot(created, {
      displayName: " JPM Updated ",
      now: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(updated.displayName).toBe("JPM Updated");
  });

  it("rejects invalid provider details", () => {
    expect(() =>
      createRequisiteProviderSnapshot({
        id: "00000000-0000-4000-8000-000000000111",
        now: new Date("2026-01-01T00:00:00.000Z"),
        kind: "bank",
        legalName: "JPM",
        displayName: "JPM",
        description: null,
        country: null,
        website: null,
      }),
    ).toThrow(DomainError);
  });
});
