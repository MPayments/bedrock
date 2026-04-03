import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createIntegrationRuntime } from "./runtime";
import { db } from "./setup";
import { schema as partiesSchema } from "../../src/schema";

function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

describe("parties counterparties integration", () => {
  it("creates, lists, finds, updates, and removes counterparties", async () => {
    const { module } = createIntegrationRuntime();
    const customer = await module.customers.commands.create({
      displayName: uniqueLabel("Customer"),
      externalRef: uniqueLabel("crm"),
    });
    const groups = await module.counterparties.queries.listGroups({
      customerId: customer.id,
      includeSystem: true,
    });
    const managedGroup = groups[0]!;
    const sharedGroup = await module.counterparties.commands.createGroup({
      code: uniqueLabel("shared"),
      name: "Shared",
    });
    const nestedGroup = await module.counterparties.commands.createGroup({
      code: uniqueLabel("nested"),
      name: "Nested",
      parentId: managedGroup.id,
    });

    const created = await module.counterparties.commands.create({
      shortName: "Acme CP",
      fullName: "Acme Counterparty",
      customerId: customer.id,
      groupIds: [sharedGroup.id, nestedGroup.id],
    });

    expect(created.groupIds).toEqual([
      sharedGroup.id,
      nestedGroup.id,
      managedGroup.id,
    ]);

    const listed = await module.counterparties.queries.list({
      shortName: "Acme",
    });
    expect(listed.total).toBe(1);
    expect(listed.data[0]?.id).toBe(created.id);

    const found = await module.counterparties.queries.findById(created.id);
    expect(found.id).toBe(created.id);

    const updated = await module.counterparties.commands.update(created.id, {
      customerId: null,
    });
    expect(updated.customerId).toBeNull();
    expect(updated.groupIds).toEqual([sharedGroup.id]);

    await module.counterparties.commands.remove(created.id);

    const rows = await db
      .select()
      .from(partiesSchema.counterparties)
      .where(eq(partiesSchema.counterparties.id, created.id));
    expect(rows).toHaveLength(0);
  });

  it("creates, updates, lists, and removes counterparty groups", async () => {
    const { module } = createIntegrationRuntime();
    const root = await module.counterparties.commands.createGroup({
      code: uniqueLabel("root"),
      name: "Root",
    });

    const updated = await module.counterparties.commands.updateGroup(root.id, {
      name: "Root Updated",
    });
    expect(updated.name).toBe("Root Updated");

    const listed = await module.counterparties.queries.listGroups({
      includeSystem: true,
    });
    expect(listed.map((group) => group.id)).toContain(root.id);

    await module.counterparties.commands.removeGroup(root.id);

    const rows = await db
      .select()
      .from(partiesSchema.counterpartyGroups)
      .where(eq(partiesSchema.counterpartyGroups.id, root.id));
    expect(rows).toHaveLength(0);
  });

  it("reparents children when a group is removed", async () => {
    const { module } = createIntegrationRuntime();
    const root = await module.counterparties.commands.createGroup({
      code: uniqueLabel("root"),
      name: "Root",
    });
    const child = await module.counterparties.commands.createGroup({
      code: uniqueLabel("child"),
      name: "Child",
      parentId: root.id,
    });
    const grandchild = await module.counterparties.commands.createGroup({
      code: uniqueLabel("grandchild"),
      name: "Grandchild",
      parentId: child.id,
    });

    await module.counterparties.commands.removeGroup(child.id);

    const [reparented] = await db
      .select()
      .from(partiesSchema.counterpartyGroups)
      .where(eq(partiesSchema.counterpartyGroups.id, grandchild.id));

    expect(reparented?.parentId).toBe(root.id);
  });

  it("exposes counterparties query helpers", async () => {
    const { module, queries } = createIntegrationRuntime();
    const customer = await module.customers.commands.create({
      displayName: uniqueLabel("Customer"),
      externalRef: uniqueLabel("crm"),
    });
    const [managedGroup] = await module.counterparties.queries.listGroups({
      customerId: customer.id,
      includeSystem: true,
    });
    const leafGroup = await module.counterparties.commands.createGroup({
      code: uniqueLabel("leaf"),
      name: "Leaf",
      parentId: managedGroup!.id,
    });
    const counterparty = await module.counterparties.commands.create({
      shortName: "Query CP",
      fullName: "Query Counterparty",
      customerId: customer.id,
      groupIds: [leafGroup.id],
    });

    const [names, directMembers, nestedMembers] = await Promise.all([
      queries.counterparties.listShortNamesById([counterparty.id]),
      queries.counterparties.listGroupMembers({
        groupIds: [managedGroup!.id],
        includeDescendants: false,
      }),
      queries.counterparties.listGroupMembers({
        groupIds: [managedGroup!.id],
        includeDescendants: true,
      }),
    ]);

    expect(names.get(counterparty.id)).toBe(counterparty.shortName);
    expect(directMembers).toEqual([
      {
        rootGroupId: managedGroup!.id,
        counterpartyId: counterparty.id,
      },
    ]);
    expect(nestedMembers).toEqual([
      {
        rootGroupId: managedGroup!.id,
        counterpartyId: counterparty.id,
      },
    ]);
  });
});
