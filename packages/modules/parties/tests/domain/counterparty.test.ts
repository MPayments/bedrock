import { DomainError } from "@bedrock/shared/core/domain";

import { Counterparty } from "../../src/domain/counterparty";
import { GroupHierarchy } from "../../src/domain/group-hierarchy";

describe("Counterparty", () => {
  it("rejects poisoned required names when update keeps the current snapshot", () => {
    const hierarchy = GroupHierarchy.create([]);
    const counterparty = Counterparty.create(
      {
        id: "counterparty-1",
        shortName: "Acme",
        fullName: "Acme LLC",
      },
      {
        hierarchy,
        now: new Date("2026-01-01T00:00:00.000Z"),
      },
    );

    (counterparty as any).snapshot = {
      ...counterparty.toSnapshot(),
      shortName: undefined,
    };

    expect(() =>
      counterparty.update(
        {},
        {
          hierarchy,
          now: new Date("2026-01-02T00:00:00.000Z"),
        },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "counterparty.short_name_required",
      }),
    );
  });
});
