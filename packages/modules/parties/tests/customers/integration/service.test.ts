import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from "@bedrock/auth/schema";
import { schema as counterpartiesSchema } from "@bedrock/parties/counterparties/schema";
import { schema as customersSchema } from "@bedrock/parties/customers/schema";

import { db, pool } from "./setup";
import {
  CustomerDeleteConflictError,
  createCustomersService,
} from "../../../src/customers/index";

const schema = {
  ...customersSchema,
  ...counterpartiesSchema,
  user,
  account,
  session,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
};

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

  it("removes customer and deletes customer-scoped group subtree", async () => {
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

    const [customerLeaf] = await db
      .insert(schema.counterpartyGroups)
      .values({
        code: uniq("customer-leaf"),
        name: "Customer Leaf",
        description: "Integration test node",
        parentId: customerGroup!.id,
        customerId: customer.id,
        isSystem: false,
      })
      .returning({ id: schema.counterpartyGroups.id });

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
        groupId: customerLeaf!.id,
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

    const customerTreeGroups = await db
      .select({ id: schema.counterpartyGroups.id })
      .from(schema.counterpartyGroups)
      .where(
        inArray(schema.counterpartyGroups.id, [
          customerGroup!.id,
          customerLeaf!.id,
        ]),
      );

    expect(customersRoot).toBeDefined();
    expect(removedCustomer).toBeUndefined();
    expect(detachedCounterparty).toBeDefined();
    expect(detachedCounterparty!.customerId).toBeNull();
    expect(memberships).toEqual([{ groupId: treasuryLeaf!.id }]);
    expect(customerTreeGroups).toEqual([]);
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

    const occurredAt = new Date();

    await pool.query(
      `
        INSERT INTO documents (
          id,
          doc_type,
          doc_no,
          payload_version,
          payload,
          title,
          occurred_at,
          submission_status,
          approval_status,
          posting_status,
          lifecycle_status,
          create_idempotency_key,
          amount_minor,
          currency,
          memo,
          counterparty_id,
          customer_id,
          organization_requisite_id,
          search_text,
          created_by,
          submitted_by,
          submitted_at,
          approved_by,
          approved_at,
          rejected_by,
          rejected_at,
          cancelled_by,
          cancelled_at,
          posting_started_at,
          posted_at,
          posting_error,
          created_at,
          updated_at,
          version
        )
        VALUES (
          $1, $2, $3, $4, $5::jsonb, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24,
          $25, $26, $27, $28, $29, $30, $31, $32, $33, $34
        )
      `,
      [
        randomUUID(),
        "payment_case",
        `PAY-${randomUUID().slice(0, 8).toUpperCase()}`,
        1,
        JSON.stringify({
          customerId: customer.id,
          subject: "Customer linked payment case",
          occurredAt: occurredAt.toISOString(),
        }),
        "Customer linked payment case",
        occurredAt,
        "draft",
        "not_required",
        "not_required",
        "active",
        randomUUID(),
        null,
        null,
        null,
        counterparty!.id,
        customer.id,
        null,
        "customer linked payment case",
        createdBy,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        occurredAt,
        occurredAt,
        1,
      ],
    );

    await expect(service.remove(customer.id)).rejects.toThrow(
      CustomerDeleteConflictError,
    );

    const [stillExists] = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(eq(schema.customers.id, customer.id))
      .limit(1);

    const documents = await pool.query(
      `
        SELECT id
        FROM documents
        WHERE customer_id = $1
          AND counterparty_id = $2
      `,
      [customer.id, counterparty!.id],
    );

    expect(stillExists).toBeDefined();
    expect(documents.rows).toHaveLength(1);
  });
});
