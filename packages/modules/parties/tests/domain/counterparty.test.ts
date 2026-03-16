import { describe,expect,it } from "vitest";

import type { DomainError } from "@bedrock/shared/core/domain";

import { Counterparty } from "../../src/domain/counterparty";
import { GroupHierarchy } from "../../src/domain/group-hierarchy";

describe("Counterparty", () => {
  it("rejects poisoned required names when update keeps the current snapshot", () => {
    const hierarchy = GroupHierarchy.create([]);
    const counterparty = Counterparty.create(
      {
        id: "counterparty-1",
        externalId: null,
        customerId: null,
        shortName: "Acme",
        fullName: "Acme LLC",
        description: null,
        country: null,
        kind: "legal_entity",
        groupIds: [],
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
    const poisonedSnapshot = (counterparty as any).snapshot;

    expect(() =>
      counterparty.update(
        {
          externalId: poisonedSnapshot.externalId,
          customerId: poisonedSnapshot.customerId,
          shortName: poisonedSnapshot.shortName,
          fullName: poisonedSnapshot.fullName,
          description: poisonedSnapshot.description,
          country: poisonedSnapshot.country,
          kind: poisonedSnapshot.kind,
          groupIds: poisonedSnapshot.groupIds,
        },
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
