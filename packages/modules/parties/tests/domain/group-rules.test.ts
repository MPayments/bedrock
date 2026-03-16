import { describe, expect, it } from "vitest";

import { DomainError } from "@bedrock/shared/core/domain";

import {
  GroupHierarchy,
  GroupMembershipClassification,
} from "../../src/domain/group-hierarchy";

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

describe("group hierarchy", () => {
  it("classifies customer-scoped membership by ancestry", () => {
    const result = GroupHierarchy.create([...GROUPS]).classifyMembership([
      "customer-leaf",
      "shared-leaf",
      "customer-leaf",
    ]);

    expect(result.customerScopeByGroupId.get("customer-leaf")).toBe("cust-abc");
    expect(result.customerScopeByGroupId.get("shared-leaf")).toBeNull();
    expect(result.customerScopedIds).toEqual(new Set(["cust-abc"]));
  });

  it("throws when group is missing", () => {
    expect(() =>
      GroupHierarchy.create([...GROUPS]).classifyMembership(["missing-group"]),
    ).toThrow(DomainError);
  });

  it("throws on group hierarchy loop", () => {
    expect(() =>
      GroupHierarchy.create([
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
      ]).classifyMembership(["a"]),
    ).toThrow(DomainError);
  });

  it("enforces customer link rules", () => {
    expect(() =>
      GroupMembershipClassification.empty().assertCustomerLink(null)
    ).not.toThrow();
    expect(() =>
      new GroupMembershipClassification(
        new Map([["group-1", "cust-1"]]),
        new Set(["cust-1"]),
      ).assertCustomerLink(null)
    ).toThrow(DomainError);
    expect(() =>
      new GroupMembershipClassification(
        new Map([["group-1", "cust-2"]]),
        new Set(["cust-2"]),
      ).assertCustomerLink("cust-1")
    ).toThrow(DomainError);
  });

  it("lists subtree ids", () => {
    expect(
      GroupHierarchy.create([...GROUPS]).listSubtreeIds("shared-root"),
    ).toEqual(["shared-root", "shared-leaf"]);
  });
});
