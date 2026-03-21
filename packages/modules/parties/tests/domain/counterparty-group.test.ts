import { describe, expect, it } from "vitest";

import { DomainError } from "@bedrock/shared/core/domain";

import { CounterpartyGroup } from "../../src/counterparties/domain/counterparty-group";
import { GroupHierarchy } from "../../src/shared/domain/group-hierarchy";

const GROUPS = [
  {
    id: "root",
    code: "root",
    parentId: null,
    customerId: null,
  },
  {
    id: "managed-root",
    code: "customer:cust-1",
    parentId: null,
    customerId: "cust-1",
  },
  {
    id: "managed-leaf",
    code: "leaf",
    parentId: "managed-root",
    customerId: null,
  },
  {
    id: "descendant",
    code: "descendant",
    parentId: "managed-leaf",
    customerId: null,
  },
] as const;

describe("counterparty group domain", () => {
  it("inherits scoped customer id from a managed parent", () => {
    const group = CounterpartyGroup.create(
      {
        id: "child",
        code: "child",
        name: "Child",
        description: null,
        parentId: "managed-root",
        customerId: null,
        isSystem: false,
      },
      {
        parent: GROUPS[1],
        now: new Date("2026-01-01T00:00:00.000Z"),
      },
    );

    expect(group.toSnapshot().customerId).toBe("cust-1");
  });

  it("rejects reserved managed-group codes for custom groups", () => {
    expect(() =>
      CounterpartyGroup.create(
        {
          id: "group-1",
          code: "customer:custom",
          name: "Reserved",
          description: null,
          parentId: null,
          customerId: null,
          isSystem: false,
        },
        {
          parent: null,
          now: new Date("2026-01-01T00:00:00.000Z"),
        },
      ),
    ).toThrow(DomainError);
  });

  it("creates managed customer groups through the dedicated factory", () => {
    const group = CounterpartyGroup.createManagedCustomerGroup(
      {
        id: "managed-root",
        customerId: "cust-1",
        displayName: "Managed Customer",
      },
      {
        now: new Date("2026-01-01T00:00:00.000Z"),
      },
    );

    expect(group.toSnapshot()).toEqual(
      expect.objectContaining({
        code: "customer:cust-1",
        customerId: "cust-1",
        name: "Managed Customer",
        parentId: null,
      }),
    );
  });

  it("rejects descendant cycles on update", () => {
    const existing = CounterpartyGroup.fromSnapshot({
      id: "managed-leaf",
      code: "leaf",
      name: "Leaf",
      description: null,
      parentId: "managed-root",
      customerId: "cust-1",
      isSystem: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(() =>
      existing.update(
        {
          code: "leaf",
          name: "Leaf",
          description: null,
          parentId: "descendant",
          customerId: "cust-1",
        },
        {
          hierarchy: GroupHierarchy.create([...GROUPS]),
          now: new Date("2026-01-02T00:00:00.000Z"),
        },
      ),
    ).toThrow(DomainError);
  });

  it("rejects removing managed groups", () => {
    const managed = CounterpartyGroup.fromSnapshot({
      id: "managed-root",
      code: "customer:cust-1",
      name: "Managed",
      description: null,
      parentId: null,
      customerId: "cust-1",
      isSystem: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(() => managed.assertRemovable()).toThrow(DomainError);
  });

  it("rejects malformed managed group snapshots", () => {
    expect(() =>
      CounterpartyGroup.fromSnapshot({
        id: "managed-root",
        code: "customer:cust-1",
        name: "Managed",
        description: null,
        parentId: "root",
        customerId: null,
        isSystem: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrow(DomainError);
  });
});
