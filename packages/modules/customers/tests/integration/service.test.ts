import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { schema } from "@bedrock/customers/schema";

import { db } from "./setup";
import {
  CustomerDeleteConflictError,
  createCustomersService,
} from "../../src/index";

function uniq(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("Customers service integration", () => {
  it("creates system groups and customer group", async () => {
    const service = createCustomersService({ db });

    const created = await service.create({
      displayName: "Acme Corp",
      externalRef: "crm-acme",
    });

    const roots = await db
      .select({
        id: schema.counterpartyGroups.id,
        code: schema.counterpartyGroups.code,
      })
      .from(schema.counterpartyGroups)
      .where(
        inArray(schema.counterpartyGroups.code, ["treasury", "customers"]),
      );

    const customersRoot = roots.find((group) => group.code === "customers");
    const customerGroupCode = `customer:${created.id}`;
    const [customerGroup] = await db
      .select()
      .from(schema.counterpartyGroups)
      .where(eq(schema.counterpartyGroups.code, customerGroupCode))
      .limit(1);

    expect(roots).toHaveLength(2);
    expect(customersRoot).toBeDefined();
    expect(customerGroup).toBeDefined();
    expect(customerGroup!.parentId).toBe(customersRoot!.id);
    expect(customerGroup!.name).toBe("Acme Corp");
  });

  it("updates customer display name and syncs customer group name", async () => {
    const service = createCustomersService({ db });
    const created = await service.create({
      displayName: "Old Name",
      externalRef: "crm-old",
    });

    const updated = await service.update(created.id, {
      displayName: "New Name",
    });

    const [group] = await db
      .select({
        name: schema.counterpartyGroups.name,
      })
      .from(schema.counterpartyGroups)
      .where(eq(schema.counterpartyGroups.code, `customer:${created.id}`))
      .limit(1);

    expect(updated.displayName).toBe("New Name");
    expect(group).toBeDefined();
    expect(group!.name).toBe("New Name");
  });

  it("removes customer and detaches counterparties from customer tree only", async () => {
    const service = createCustomersService({ db });
    const customer = await service.create({
      displayName: "Detach Me",
      externalRef: "crm-detach",
    });

    const [customersRoot] = await db
      .select({ id: schema.counterpartyGroups.id })
      .from(schema.counterpartyGroups)
      .where(eq(schema.counterpartyGroups.code, "customers"))
      .limit(1);

    const [treasuryRoot] = await db
      .select({ id: schema.counterpartyGroups.id })
      .from(schema.counterpartyGroups)
      .where(eq(schema.counterpartyGroups.code, "treasury"))
      .limit(1);

    const [customerGroup] = await db
      .select({ id: schema.counterpartyGroups.id })
      .from(schema.counterpartyGroups)
      .where(eq(schema.counterpartyGroups.code, `customer:${customer.id}`))
      .limit(1);

    const [treasuryLeaf] = await db
      .insert(schema.counterpartyGroups)
      .values({
        code: uniq("treasury-leaf"),
        name: "Treasury Leaf",
        description: "Integration test node",
        parentId: treasuryRoot!.id,
        customerId: null,
        isSystem: false,
      })
      .returning({ id: schema.counterpartyGroups.id });

    const [counterparty] = await db
      .insert(schema.counterparties)
      .values({
        externalId: uniq("cp-ext"),
        customerId: customer.id,
        shortName: "Counterparty A",
        fullName: "Counterparty A LLC",
        description: "Integration test counterparty",
        country: "US",
        kind: "legal_entity",
      })
      .returning({ id: schema.counterparties.id });

    await db.insert(schema.counterpartyGroupMemberships).values([
      {
        counterpartyId: counterparty!.id,
        groupId: customerGroup!.id,
      },
      {
        counterpartyId: counterparty!.id,
        groupId: treasuryLeaf!.id,
      },
    ]);

    await service.remove(customer.id);

    const [removedCustomer] = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(eq(schema.customers.id, customer.id))
      .limit(1);

    const [detachedCounterparty] = await db
      .select({ customerId: schema.counterparties.customerId })
      .from(schema.counterparties)
      .where(eq(schema.counterparties.id, counterparty!.id))
      .limit(1);

    const memberships = await db
      .select({ groupId: schema.counterpartyGroupMemberships.groupId })
      .from(schema.counterpartyGroupMemberships)
      .where(
        eq(
          schema.counterpartyGroupMemberships.counterpartyId,
          counterparty!.id,
        ),
      );

    expect(customersRoot).toBeDefined();
    expect(removedCustomer).toBeUndefined();
    expect(detachedCounterparty).toBeDefined();
    expect(detachedCounterparty!.customerId).toBeNull();
    expect(memberships).toEqual([{ groupId: treasuryLeaf!.id }]);
  });

  it("blocks remove when document references customer", async () => {
    const service = createCustomersService({ db });
    const customer = await service.create({
      displayName: "Has Orders",
      externalRef: "crm-orders",
    });
    const createdBy = randomUUID();

    const [counterparty] = await db
      .insert(schema.counterparties)
      .values({
        externalId: uniq("cp-order"),
        customerId: customer.id,
        shortName: "Order Counterparty",
        fullName: "Order Counterparty LLC",
        description: "Integration test counterparty",
        country: "US",
        kind: "legal_entity",
      })
      .returning({ id: schema.counterparties.id });

    await db.insert(schema.user).values({
      id: createdBy,
      name: "Integration User",
      email: `${createdBy}@example.com`,
      emailVerified: true,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.documents).values({
      id: randomUUID(),
      docType: "payment_case",
      docNo: `PAY-${randomUUID().slice(0, 8).toUpperCase()}`,
      payloadVersion: 1,
      payload: {
        customerId: customer.id,
        subject: "Customer linked payment case",
        occurredAt: new Date().toISOString(),
      },
      title: "Customer linked payment case",
      occurredAt: new Date(),
      submissionStatus: "draft",
      approvalStatus: "not_required",
      postingStatus: "not_required",
      lifecycleStatus: "active",
      createIdempotencyKey: randomUUID(),
      amountMinor: null,
      currency: null,
      memo: null,
      counterpartyId: counterparty!.id,
      customerId: customer.id,
      operationalAccountId: null,
      searchText: "customer linked payment case",
      createdBy,
      submittedBy: null,
      submittedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      cancelledBy: null,
      cancelledAt: null,
      postingStartedAt: null,
      postedAt: null,
      postingError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });

    await expect(service.remove(customer.id)).rejects.toThrow(
      CustomerDeleteConflictError,
    );

    const [stillExists] = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(eq(schema.customers.id, customer.id))
      .limit(1);

    const documents = await db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.customerId, customer.id),
          eq(schema.documents.counterpartyId, counterparty!.id),
        ),
      );

    expect(stillExists).toBeDefined();
    expect(documents).toHaveLength(1);
  });
});
