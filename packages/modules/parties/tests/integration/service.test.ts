import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { db, pool } from "./setup";
import {
  CounterpartySystemGroupDeleteError,
  CustomerDeleteConflictError,
  createPartiesService,
} from "../../src";
import { createPartiesQueries } from "../../src/queries";
import { schema as partiesSchema } from "../../src/infra/drizzle/schema";

function createRuntime(options?: {
  hasDocumentsForCustomer?: (customerId: string) => Promise<boolean>;
}) {
  return {
    service: createPartiesService({
      db,
      documents: {
        hasDocumentsForCustomer(customerId) {
          return (
            options?.hasDocumentsForCustomer?.(customerId) ?? Promise.resolve(false)
          );
        },
      },
    }),
    queries: createPartiesQueries({ db }),
  };
}

function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

describe("parties integration", () => {
  it("creates and renames managed customer groups", async () => {
    const { service } = createRuntime();

    const created = await service.customers.create({
      displayName: uniqueLabel("Acme"),
      externalRef: uniqueLabel("crm"),
    });

    const groups = await service.groups.list({
      customerId: created.id,
      includeSystem: true,
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.code).toBe(`customer:${created.id}`);
    expect(groups[0]!.customerLabel).toBe(created.displayName);

    await service.customers.update(created.id, {
      displayName: `${created.displayName} Updated`,
    });

    const renamedGroups = await service.groups.list({
      customerId: created.id,
      includeSystem: true,
    });
    expect(renamedGroups[0]!.name).toContain("Updated");
  });

  it("deletes customer-scoped group subtree and detaches counterparties on customer removal", async () => {
    const { service } = createRuntime();
    const customer = await service.customers.create({
      displayName: uniqueLabel("Detach"),
      externalRef: uniqueLabel("crm"),
    });
    const [managedGroup] = await service.groups.list({
      customerId: customer.id,
      includeSystem: true,
    });
    const nestedGroup = await service.groups.create({
      code: uniqueLabel("nested"),
      name: "Nested",
      parentId: managedGroup!.id,
    });

    const sharedGroup = await service.groups.create({
      code: uniqueLabel("shared"),
      name: "Shared",
    });

    const counterparty = await service.counterparties.create({
      shortName: "Acme CP",
      fullName: "Acme Counterparty",
      customerId: customer.id,
      groupIds: [nestedGroup.id, sharedGroup.id],
    });

    await service.customers.remove(customer.id);

    const detached = await service.counterparties.findById(counterparty.id);
    expect(detached.customerId).toBeNull();
    expect(detached.groupIds).toEqual([sharedGroup.id]);

    const remainingGroups = await service.groups.list({ includeSystem: true });
    expect(remainingGroups.map((group) => group.id)).not.toContain(managedGroup!.id);
    expect(remainingGroups.map((group) => group.id)).not.toContain(nestedGroup.id);
  });

  it("blocks customer delete when documents read port reports references", async () => {
    const { service } = createRuntime({
      hasDocumentsForCustomer: async () => true,
    });
    const customer = await service.customers.create({
      displayName: uniqueLabel("Blocked"),
      externalRef: uniqueLabel("crm"),
    });

    await expect(service.customers.remove(customer.id)).rejects.toBeInstanceOf(
      CustomerDeleteConflictError,
    );
  });

  it("creates, updates, removes groups, and rejects system group deletion", async () => {
    const { service } = createRuntime();
    const root = await service.groups.create({
      code: uniqueLabel("group"),
      name: "Group Root",
    });

    const updated = await service.groups.update(root.id, {
      name: "Group Root Updated",
    });
    expect(updated.name).toBe("Group Root Updated");

    await service.groups.remove(root.id);
    expect(await service.groups.list({ includeSystem: true })).toHaveLength(0);

    const [systemGroup] = await db
      .insert(partiesSchema.counterpartyGroups)
      .values({
        code: uniqueLabel("system"),
        name: "System Group",
        description: null,
        parentId: null,
        customerId: null,
        isSystem: true,
      })
      .returning();

    await expect(service.groups.remove(systemGroup!.id)).rejects.toBeInstanceOf(
      CounterpartySystemGroupDeleteError,
    );
  });

  it("supports query surfaces for display names and group members", async () => {
    const { queries, service } = createRuntime();
    const customer = await service.customers.create({
      displayName: uniqueLabel("Customer"),
      externalRef: uniqueLabel("crm"),
    });
    const [managedGroup] = await service.groups.list({
      customerId: customer.id,
      includeSystem: true,
    });
    const leafGroup = await service.groups.create({
      code: uniqueLabel("leaf"),
      name: "Leaf",
      parentId: managedGroup!.id,
    });
    const counterparty = await service.counterparties.create({
      shortName: "Query CP",
      fullName: "Query Counterparty",
      customerId: customer.id,
      groupIds: [leafGroup.id],
    });

    const [customerNames, counterpartyNames, directMembers, nestedMembers] =
      await Promise.all([
        queries.customers.listDisplayNamesById([customer.id]),
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

    expect(customerNames.get(customer.id)).toBe(customer.displayName);
    expect(counterpartyNames.get(counterparty.id)).toBe(counterparty.shortName);
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

  it("stores customer labels on group list rows", async () => {
    const { service } = createRuntime();
    const customer = await service.customers.create({
      displayName: uniqueLabel("Label"),
      externalRef: uniqueLabel("crm"),
    });

    const groups = await service.groups.list({
      customerId: customer.id,
      includeSystem: true,
    });

    expect(groups[0]).toEqual(
      expect.objectContaining({
        customerId: customer.id,
        customerLabel: customer.displayName,
      }),
    );
  });
});
