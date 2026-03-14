import { and, eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
import { COUNTERPARTIES, CUSTOMERS } from "./fixtures";

type SeedDb = Database | Transaction;

const CUSTOMER_GROUP_CODE_PREFIX = "customer:";

function customerGroupCode(customerId: string) {
  return `${CUSTOMER_GROUP_CODE_PREFIX}${customerId}`;
}

async function upsertCustomers(db: SeedDb) {
  for (const customer of CUSTOMERS) {
    await db
      .insert(schema.customers)
      .values({
        id: customer.id,
        displayName: customer.displayName,
        externalRef: customer.externalRef,
      })
      .onConflictDoUpdate({
        target: schema.customers.id,
        set: {
          displayName: customer.displayName,
          externalRef: customer.externalRef,
        },
      });
  }
}

async function upsertCounterparties(db: SeedDb) {
  for (const counterparty of COUNTERPARTIES) {
    await db
      .insert(schema.counterparties)
      .values({
        id: counterparty.id,
        externalId: counterparty.externalId,
        customerId: counterparty.customerId,
        shortName: counterparty.shortName,
        fullName: counterparty.fullName,
        kind: counterparty.kind,
        country: counterparty.country,
      })
      .onConflictDoUpdate({
        target: schema.counterparties.id,
        set: {
          externalId: counterparty.externalId,
          customerId: counterparty.customerId,
          shortName: counterparty.shortName,
          fullName: counterparty.fullName,
          kind: counterparty.kind,
          country: counterparty.country,
        },
      });
  }
}

async function ensureManagedCustomerGroups(
  db: SeedDb,
): Promise<Map<string, string>> {
  for (const customer of CUSTOMERS) {
    await db
      .insert(schema.counterpartyGroups)
      .values({
        code: customerGroupCode(customer.id),
        name: customer.displayName,
        description: "Auto-created customer group",
        parentId: null,
        customerId: customer.id,
        isSystem: false,
      })
      .onConflictDoUpdate({
        target: schema.counterpartyGroups.code,
        set: {
          name: customer.displayName,
          description: "Auto-created customer group",
          parentId: null,
          customerId: customer.id,
          isSystem: false,
        },
      });
  }

  const groups = await db
    .select({
      id: schema.counterpartyGroups.id,
      code: schema.counterpartyGroups.code,
    })
    .from(schema.counterpartyGroups)
    .where(
      inArray(
        schema.counterpartyGroups.code,
        CUSTOMERS.map((customer) => customerGroupCode(customer.id)),
      ),
    );

  const groupsByCustomerId = new Map(
    groups.map((group) => [
      group.code.slice(CUSTOMER_GROUP_CODE_PREFIX.length),
      group.id,
    ]),
  );

  for (const customer of CUSTOMERS) {
    if (!groupsByCustomerId.has(customer.id)) {
      throw new Error(
        `[seed:counterparties] Missing managed customer group for customer ${customer.id}`,
      );
    }
  }

  return groupsByCustomerId;
}

async function ensureManagedCustomerMemberships(
  db: SeedDb,
  groupsByCustomerId: Map<string, string>,
) {
  const managedGroupIds = [...groupsByCustomerId.values()];

  for (const counterparty of COUNTERPARTIES) {
    const managedGroupId = groupsByCustomerId.get(counterparty.customerId);
    if (!managedGroupId) {
      throw new Error(
        `[seed:counterparties] Missing managed group for counterparty ${counterparty.id}`,
      );
    }

    const staleManagedGroupIds = managedGroupIds.filter(
      (groupId) => groupId !== managedGroupId,
    );

    if (staleManagedGroupIds.length > 0) {
      await db
        .delete(schema.counterpartyGroupMemberships)
        .where(
          and(
            eq(
              schema.counterpartyGroupMemberships.counterpartyId,
              counterparty.id,
            ),
            inArray(
              schema.counterpartyGroupMemberships.groupId,
              staleManagedGroupIds,
            ),
          ),
        );
    }

    await db
      .insert(schema.counterpartyGroupMemberships)
      .values({
        counterpartyId: counterparty.id,
        groupId: managedGroupId,
      })
      .onConflictDoNothing();
  }
}

export async function seedCounterparties(db: SeedDb) {
  await upsertCustomers(db);
  await upsertCounterparties(db);
  const groupsByCustomerId = await ensureManagedCustomerGroups(db);
  await ensureManagedCustomerMemberships(db, groupsByCustomerId);

  console.log(
    `[seed:counterparties] Seeded ${COUNTERPARTIES.length} counterparties (${CUSTOMERS.length} customers and ${groupsByCustomerId.size} managed groups ensured)`,
  );
}
