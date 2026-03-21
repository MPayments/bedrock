import { describe, expect, it } from "vitest";

import { DomainError } from "@bedrock/shared/core/domain";

import { Counterparty } from "../../src/counterparties/domain/counterparty";
import { GroupHierarchy } from "../../src/shared/domain/group-hierarchy";

const hierarchy = GroupHierarchy.create([
  {
    id: "shared-group",
    code: "shared",
    parentId: null,
    customerId: null,
  },
  {
    id: "managed-group",
    code: "customer:cust-1",
    parentId: null,
    customerId: "cust-1",
  },
  {
    id: "customer-leaf",
    code: "leaf",
    parentId: "managed-group",
    customerId: null,
  },
]);

describe("counterparty domain", () => {
  it("auto-attaches the managed customer group", () => {
    const counterparty = Counterparty.create(
      {
        id: "cp-1",
        externalId: null,
        customerId: "cust-1",
        shortName: " Acme ",
        fullName: " Acme Incorporated ",
        description: "  ",
        country: "us",
        kind: "legal_entity",
        groupIds: ["shared-group", "shared-group"],
      },
      {
        hierarchy,
        managedGroupId: "managed-group",
        now: new Date("2026-01-01T00:00:00.000Z"),
      },
    );

    expect(counterparty.toSnapshot().groupIds).toEqual([
      "shared-group",
      "managed-group",
    ]);
    expect(counterparty.toSnapshot().country).toBe("US");
    expect(counterparty.toSnapshot().description).toBeNull();
  });

  it("rejects customer-scoped groups without a customer link", () => {
    expect(() =>
      Counterparty.create(
        {
          id: "cp-1",
          externalId: null,
          customerId: null,
          shortName: "Acme",
          fullName: "Acme Incorporated",
          description: null,
          country: null,
          kind: "legal_entity",
          groupIds: ["customer-leaf"],
        },
        {
          hierarchy,
          managedGroupId: null,
          now: new Date("2026-01-01T00:00:00.000Z"),
        },
      ),
    ).toThrow(DomainError);
  });
});
