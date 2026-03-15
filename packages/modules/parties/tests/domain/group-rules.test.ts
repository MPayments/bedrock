import { describe, expect, it } from "vitest";

import {
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
} from "../../src/errors";
import {
  createGroupNodeMap,
  enforceCustomerLinkRules,
  listGroupSubtreeIds,
  resolveGroupMembershipClassification,
  type GroupMembershipClassification,
} from "../../src/domain/group-rules";

const GROUPS = [
  {
    id: "shared-root",
    code: "shared-root",
    parentId: null,
    customerId: null,
  },
  {
    id: "customer-root",
    code: "customer:abc",
    parentId: null,
    customerId: "cust-abc",
  },
  {
    id: "customer-leaf",
    code: "customer-leaf",
    parentId: "customer-root",
    customerId: null,
  },
  {
    id: "shared-leaf",
    code: "shared-leaf",
    parentId: "shared-root",
    customerId: null,
  },
] as const;

function makeClassification(
  overrides: Partial<GroupMembershipClassification> = {},
): GroupMembershipClassification {
  return {
    customerScopeByGroupId: new Map(),
    customerScopedIds: new Set(),
    ...overrides,
  };
}

describe("group rules", () => {
  it("classifies customer-scoped membership by ancestry", () => {
    const result = resolveGroupMembershipClassification({
      groupMap: createGroupNodeMap([...GROUPS]),
      rawGroupIds: ["customer-leaf", "shared-leaf", "customer-leaf"],
    });

    expect(result.customerScopeByGroupId.get("customer-leaf")).toBe("cust-abc");
    expect(result.customerScopeByGroupId.get("shared-leaf")).toBeNull();
    expect(result.customerScopedIds).toEqual(new Set(["cust-abc"]));
  });

  it("throws when group is missing", () => {
    expect(() =>
      resolveGroupMembershipClassification({
        groupMap: createGroupNodeMap([...GROUPS]),
        rawGroupIds: ["missing-group"],
      }),
    ).toThrow(CounterpartyGroupNotFoundError);
  });

  it("throws on group hierarchy loop", () => {
    expect(() =>
      resolveGroupMembershipClassification({
        groupMap: createGroupNodeMap([
          {
            id: "a",
            code: "a",
            parentId: "b",
            customerId: null,
          },
          {
            id: "b",
            code: "b",
            parentId: "a",
            customerId: null,
          },
        ]),
        rawGroupIds: ["a"],
      }),
    ).toThrow(CounterpartyGroupRuleError);
  });

  it("enforces customer link rules", () => {
    expect(() => enforceCustomerLinkRules(makeClassification(), null)).not.toThrow();
    expect(() =>
      enforceCustomerLinkRules(
        makeClassification({
          customerScopeByGroupId: new Map([["group-1", "cust-1"]]),
          customerScopedIds: new Set(["cust-1"]),
        }),
        null,
      ),
    ).toThrow(CounterpartyGroupRuleError);
    expect(() =>
      enforceCustomerLinkRules(
        makeClassification({
          customerScopeByGroupId: new Map([["group-1", "cust-2"]]),
          customerScopedIds: new Set(["cust-2"]),
        }),
        "cust-1",
      ),
    ).toThrow(CounterpartyGroupRuleError);
  });

  it("lists subtree ids", () => {
    expect(
      listGroupSubtreeIds({
        groups: [...GROUPS],
        rootGroupId: "shared-root",
      }),
    ).toEqual(["shared-root", "shared-leaf"]);
  });
});
