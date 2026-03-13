import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { db, pool } from "./setup";
import {
  CustomerDeleteConflictError,
  type CustomerLifecycleSyncPort,
  createCustomersService,
} from "../../../src/index";
import { customers } from "../../../src/schema";

const CUSTOMERS_ROOT_GROUP_CODE = "customers";
const TREASURY_ROOT_GROUP_CODE = "treasury";

function uniq(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createTestCustomerLifecycleSyncPort(): CustomerLifecycleSyncPort {
  async function ensureSystemRootGroups(
    tx: Parameters<CustomerLifecycleSyncPort["onCustomerCreated"]>[0],
  ) {
    await tx.execute(sql`
      INSERT INTO counterparty_groups (
        code,
        name,
        description,
        parent_id,
        customer_id,
        is_system
      )
      VALUES
        (
          ${TREASURY_ROOT_GROUP_CODE},
          'Treasury',
          'System treasury root',
          NULL,
          NULL,
          TRUE
        ),
        (
          ${CUSTOMERS_ROOT_GROUP_CODE},
          'Customers',
          'System customers root',
          NULL,
          NULL,
          TRUE
        )
      ON CONFLICT (code) DO NOTHING
    `);
  }

  return {
    async onCustomerCreated(tx, input) {
      await ensureSystemRootGroups(tx);

      await tx.execute(sql`
        INSERT INTO counterparty_groups (
          code,
          name,
          description,
          parent_id,
          customer_id,
          is_system
        )
        SELECT
          ${`customer:${input.customerId}`},
          ${input.displayName},
          'Customer-scoped counterparty group',
          root.id,
          ${input.customerId}::uuid,
          TRUE
        FROM counterparty_groups AS root
        WHERE root.code = ${CUSTOMERS_ROOT_GROUP_CODE}
        ON CONFLICT (code) DO UPDATE
        SET
          name = EXCLUDED.name,
          parent_id = EXCLUDED.parent_id,
          customer_id = EXCLUDED.customer_id,
          is_system = EXCLUDED.is_system
      `);
    },
    async onCustomerRenamed(tx, input) {
      await tx.execute(sql`
        UPDATE counterparty_groups
        SET name = ${input.displayName}
        WHERE code = ${`customer:${input.customerId}`}
      `);
    },
    async onCustomerDeleted(tx, input) {
      await tx.execute(sql`
        UPDATE counterparties
        SET customer_id = NULL
        WHERE customer_id = ${input.customerId}::uuid
      `);

      await tx.execute(sql`
        WITH RECURSIVE subtree AS (
          SELECT id
          FROM counterparty_groups
          WHERE code = ${`customer:${input.customerId}`}
          UNION ALL
          SELECT child.id
          FROM counterparty_groups AS child
          JOIN subtree ON child.parent_id = subtree.id
        )
        DELETE FROM counterparty_group_memberships
        WHERE group_id IN (SELECT id FROM subtree)
      `);

      await tx.execute(sql`
        WITH RECURSIVE subtree AS (
          SELECT id
          FROM counterparty_groups
          WHERE code = ${`customer:${input.customerId}`}
          UNION ALL
          SELECT child.id
          FROM counterparty_groups AS child
          JOIN subtree ON child.parent_id = subtree.id
        )
        DELETE FROM counterparty_groups
        WHERE id IN (SELECT id FROM subtree)
      `);
    },
  };
}

describe("Customers service integration", () => {
  it("creates system groups and customer group", async () => {
    const service = createCustomersService({
      db,
      customerLifecycleSyncPort: createTestCustomerLifecycleSyncPort(),
    });

    const created = await service.create({
      displayName: "Acme Corp",
      externalRef: "crm-acme",
    });

    const rootsResult = await pool.query<{ id: string; code: string }>(
      `
        SELECT id, code
        FROM counterparty_groups
        WHERE code = ANY($1::text[])
      `,
      [[TREASURY_ROOT_GROUP_CODE, CUSTOMERS_ROOT_GROUP_CODE]],
    );
    const roots = rootsResult.rows;
    const customersRoot = roots.find(
      (group) => group.code === CUSTOMERS_ROOT_GROUP_CODE,
    );
    const customerGroupCode = `customer:${created.id}`;
    const customerGroupResult = await pool.query<{
      id: string;
      parentId: string | null;
      name: string;
    }>(
      `
        SELECT id, parent_id AS "parentId", name
        FROM counterparty_groups
        WHERE code = $1
        LIMIT 1
      `,
      [customerGroupCode],
    );
    const customerGroup = customerGroupResult.rows[0];

    expect(roots).toHaveLength(2);
    expect(customersRoot).toBeDefined();
    expect(customerGroup).toBeDefined();
    expect(customerGroup!.parentId).toBe(customersRoot!.id);
    expect(customerGroup!.name).toBe("Acme Corp");
  });

  it("updates customer display name and syncs customer group name", async () => {
    const service = createCustomersService({
      db,
      customerLifecycleSyncPort: createTestCustomerLifecycleSyncPort(),
    });
    const created = await service.create({
      displayName: "Old Name",
      externalRef: "crm-old",
    });

    const updated = await service.update(created.id, {
      displayName: "New Name",
    });

    const groupResult = await pool.query<{ name: string }>(
      `
        SELECT name
        FROM counterparty_groups
        WHERE code = $1
        LIMIT 1
      `,
      [`customer:${created.id}`],
    );
    const group = groupResult.rows[0];

    expect(updated.displayName).toBe("New Name");
    expect(group).toBeDefined();
    expect(group!.name).toBe("New Name");
  });

  it("removes customer and deletes customer-scoped group subtree", async () => {
    const service = createCustomersService({
      db,
      customerLifecycleSyncPort: createTestCustomerLifecycleSyncPort(),
    });
    const customer = await service.create({
      displayName: "Detach Me",
      externalRef: "crm-detach",
    });

    const customersRootResult = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM counterparty_groups
        WHERE code = $1
        LIMIT 1
      `,
      [CUSTOMERS_ROOT_GROUP_CODE],
    );
    const customersRoot = customersRootResult.rows[0];

    const treasuryRootResult = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM counterparty_groups
        WHERE code = $1
        LIMIT 1
      `,
      [TREASURY_ROOT_GROUP_CODE],
    );
    const treasuryRoot = treasuryRootResult.rows[0];

    const customerGroupResult = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM counterparty_groups
        WHERE code = $1
        LIMIT 1
      `,
      [`customer:${customer.id}`],
    );
    const customerGroup = customerGroupResult.rows[0];

    const customerLeafResult = await pool.query<{ id: string }>(
      `
        INSERT INTO counterparty_groups (
          code,
          name,
          description,
          parent_id,
          customer_id,
          is_system
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [
        uniq("customer-leaf"),
        "Customer Leaf",
        "Integration test node",
        customerGroup!.id,
        customer.id,
        false,
      ],
    );
    const customerLeaf = customerLeafResult.rows[0];

    const treasuryLeafResult = await pool.query<{ id: string }>(
      `
        INSERT INTO counterparty_groups (
          code,
          name,
          description,
          parent_id,
          customer_id,
          is_system
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [
        uniq("treasury-leaf"),
        "Treasury Leaf",
        "Integration test node",
        treasuryRoot!.id,
        null,
        false,
      ],
    );
    const treasuryLeaf = treasuryLeafResult.rows[0];

    const counterpartyResult = await pool.query<{ id: string }>(
      `
        INSERT INTO counterparties (
          external_id,
          customer_id,
          short_name,
          full_name,
          description,
          country,
          kind
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        uniq("cp-ext"),
        customer.id,
        "Counterparty A",
        "Counterparty A LLC",
        "Integration test counterparty",
        "US",
        "legal_entity",
      ],
    );
    const counterparty = counterpartyResult.rows[0];

    await pool.query(
      `
        INSERT INTO counterparty_group_memberships (counterparty_id, group_id)
        VALUES ($1, $2), ($1, $3)
      `,
      [counterparty!.id, customerLeaf!.id, treasuryLeaf!.id],
    );

    await service.remove(customer.id);

    const [removedCustomer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, customer.id))
      .limit(1);

    const detachedCounterpartyResult = await pool.query<{
      customerId: string | null;
    }>(
      `
        SELECT customer_id AS "customerId"
        FROM counterparties
        WHERE id = $1
        LIMIT 1
      `,
      [counterparty!.id],
    );
    const detachedCounterparty = detachedCounterpartyResult.rows[0];

    const membershipsResult = await pool.query<{ groupId: string }>(
      `
        SELECT group_id AS "groupId"
        FROM counterparty_group_memberships
        WHERE counterparty_id = $1
      `,
      [counterparty!.id],
    );
    const memberships = membershipsResult.rows;

    const customerTreeGroupsResult = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM counterparty_groups
        WHERE id = ANY($1::uuid[])
      `,
      [[customerGroup!.id, customerLeaf!.id]],
    );
    const customerTreeGroups = customerTreeGroupsResult.rows;

    expect(customersRoot).toBeDefined();
    expect(removedCustomer).toBeUndefined();
    expect(detachedCounterparty).toBeDefined();
    expect(detachedCounterparty!.customerId).toBeNull();
    expect(memberships).toEqual([{ groupId: treasuryLeaf!.id }]);
    expect(customerTreeGroups).toEqual([]);
  });

  it("blocks remove when document references customer", async () => {
    const service = createCustomersService({
      db,
      customerLifecycleSyncPort: createTestCustomerLifecycleSyncPort(),
    });
    const customer = await service.create({
      displayName: "Has Orders",
      externalRef: "crm-orders",
    });
    const createdBy = randomUUID();

    const counterpartyResult = await pool.query<{ id: string }>(
      `
        INSERT INTO counterparties (
          external_id,
          customer_id,
          short_name,
          full_name,
          description,
          country,
          kind
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        uniq("cp-order"),
        customer.id,
        "Order Counterparty",
        "Order Counterparty LLC",
        "Integration test counterparty",
        "US",
        "legal_entity",
      ],
    );
    const counterparty = counterpartyResult.rows[0];

    await pool.query(
      `
        INSERT INTO "user" (
          id,
          name,
          email,
          email_verified,
          role,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        createdBy,
        "Integration User",
        `${createdBy}@example.com`,
        true,
        "admin",
        new Date(),
        new Date(),
      ],
    );

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
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, customer.id))
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
