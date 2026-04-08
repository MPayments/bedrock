import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createIntegrationRuntime } from "./runtime";
import { db } from "./setup";
import {
  CustomerDeleteConflictError,
} from "../../src";
import { schema as partiesSchema } from "../../src/schema";

function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

describe("parties customers integration", () => {
  it("creates, lists, finds, and renames managed customer groups", async () => {
    const { module } = createIntegrationRuntime();

    const created = await module.customers.commands.create({
      name: uniqueLabel("Acme"),
      externalRef: uniqueLabel("crm"),
    });

    const listed = await module.customers.queries.list({
      name: created.name,
    });
    expect(listed.total).toBe(1);
    expect(listed.data[0]?.id).toBe(created.id);

    const found = await module.customers.queries.findById(created.id);
    expect(found.id).toBe(created.id);

    const [group] = await db
      .select()
      .from(partiesSchema.counterpartyGroups)
      .where(eq(partiesSchema.counterpartyGroups.customerId, created.id));

    expect(group?.code).toBe(`customer:${created.id}`);
    expect(group?.name).toBe(created.name);

    await module.customers.commands.update(created.id, {
      name: `${created.name} Updated`,
    });

    const [renamedGroup] = await db
      .select()
      .from(partiesSchema.counterpartyGroups)
      .where(eq(partiesSchema.counterpartyGroups.customerId, created.id));

    expect(renamedGroup?.name).toContain("Updated");
  });

  it("detaches counterparties and deletes the managed subtree on remove", async () => {
    const { module } = createIntegrationRuntime();
    const customer = await module.customers.commands.create({
      name: uniqueLabel("Detach"),
      externalRef: uniqueLabel("crm"),
    });

    const [managedGroup] = await db
      .select()
      .from(partiesSchema.counterpartyGroups)
      .where(eq(partiesSchema.counterpartyGroups.customerId, customer.id));

    const [nestedGroup] = await db
      .insert(partiesSchema.counterpartyGroups)
      .values({
        code: uniqueLabel("nested"),
        name: "Nested",
        description: null,
        parentId: managedGroup!.id,
        customerId: null,
        isSystem: false,
      })
      .returning();

    const [sharedGroup] = await db
      .insert(partiesSchema.counterpartyGroups)
      .values({
        code: uniqueLabel("shared"),
        name: "Shared",
        description: null,
        parentId: null,
        customerId: null,
        isSystem: false,
      })
      .returning();

    const [counterparty] = await db
      .insert(partiesSchema.counterparties)
      .values({
        shortName: "Acme CP",
        fullName: "Acme Counterparty",
        customerId: customer.id,
      })
      .returning();

    await db.insert(partiesSchema.counterpartyGroupMemberships).values([
      {
        counterpartyId: counterparty!.id,
        groupId: nestedGroup!.id,
      },
      {
        counterpartyId: counterparty!.id,
        groupId: sharedGroup!.id,
      },
    ]);

    await module.customers.commands.remove(customer.id);

    const [detachedCounterparty] = await db
      .select()
      .from(partiesSchema.counterparties)
      .where(eq(partiesSchema.counterparties.id, counterparty!.id));
    expect(detachedCounterparty?.customerId).toBeNull();

    const memberships = await db
      .select()
      .from(partiesSchema.counterpartyGroupMemberships)
      .where(eq(partiesSchema.counterpartyGroupMemberships.counterpartyId, counterparty!.id));
    expect(memberships).toEqual([
      expect.objectContaining({
        counterpartyId: counterparty!.id,
        groupId: sharedGroup!.id,
      }),
    ]);

    const remainingGroups = await db.select().from(partiesSchema.counterpartyGroups);
    expect(remainingGroups.map((group) => group.id)).not.toContain(managedGroup!.id);
    expect(remainingGroups.map((group) => group.id)).not.toContain(nestedGroup!.id);
    expect(remainingGroups.map((group) => group.id)).toContain(sharedGroup!.id);
  });

  it("blocks delete when documents port reports references", async () => {
    const { module } = createIntegrationRuntime({
      hasDocumentsForCustomer: async () => true,
    });
    const customer = await module.customers.commands.create({
      name: uniqueLabel("Blocked"),
      externalRef: uniqueLabel("crm"),
    });

    await expect(module.customers.commands.remove(customer.id)).rejects.toBeInstanceOf(
      CustomerDeleteConflictError,
    );
  });

  it("exposes customer display-name queries", async () => {
    const { module, queries } = createIntegrationRuntime();
    const customer = await module.customers.commands.create({
      name: uniqueLabel("Query"),
      externalRef: uniqueLabel("crm"),
    });

    const names = await queries.customers.listNamesById([customer.id]);
    expect(names.get(customer.id)).toBe(customer.name);
  });
});
