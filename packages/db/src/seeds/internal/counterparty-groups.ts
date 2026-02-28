import { eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "../../client";
import { schema } from "../../schema";

const TREASURY_ROOT_GROUP_CODE = "treasury";
const CUSTOMERS_ROOT_GROUP_CODE = "customers";

interface SeedCustomer {
  id: string;
  displayName: string;
}

export async function ensureSeedCustomerGroups(
  db: Database | Transaction,
  customers: readonly SeedCustomer[],
): Promise<Map<string, string>> {
  const customerGroupCodes = customers.map(
    (customer) => `customer:${customer.id}`,
  );

  await db
    .insert(schema.counterpartyGroups)
    .values({
      code: TREASURY_ROOT_GROUP_CODE,
      name: "Treasury",
      description: "System root for treasury counterparties",
      parentId: null,
      customerId: null,
      isSystem: true,
    })
    .onConflictDoUpdate({
      target: schema.counterpartyGroups.code,
      set: {
        name: "Treasury",
        description: "System root for treasury counterparties",
        parentId: null,
        customerId: null,
        isSystem: true,
      },
    });

  await db
    .insert(schema.counterpartyGroups)
    .values({
      code: CUSTOMERS_ROOT_GROUP_CODE,
      name: "Customers",
      description: "System root for customer counterparties",
      parentId: null,
      customerId: null,
      isSystem: false,
    })
    .onConflictDoUpdate({
      target: schema.counterpartyGroups.code,
      set: {
        name: "Customers",
        description: "System root for customer counterparties",
        parentId: null,
        customerId: null,
        isSystem: false,
      },
    });

  const [customersRootGroup] = await db
    .select({ id: schema.counterpartyGroups.id })
    .from(schema.counterpartyGroups)
    .where(eq(schema.counterpartyGroups.code, CUSTOMERS_ROOT_GROUP_CODE))
    .limit(1);

  if (!customersRootGroup) {
    throw new Error(
      "Customers root counterparty group is not available after seeding",
    );
  }

  for (const customer of customers) {
    await db
      .insert(schema.counterpartyGroups)
      .values({
        code: `customer:${customer.id}`,
        name: `Customer ${customer.displayName}`,
        description: "Auto-created customer group",
        parentId: customersRootGroup.id,
        customerId: customer.id,
        isSystem: false,
      })
      .onConflictDoUpdate({
        target: schema.counterpartyGroups.code,
        set: {
          name: `Customer ${customer.displayName}`,
          description: "Auto-created customer group",
          parentId: customersRootGroup.id,
          customerId: customer.id,
          isSystem: false,
        },
      });
  }

  const groups =
    customerGroupCodes.length === 0
      ? []
      : await db
          .select({
            id: schema.counterpartyGroups.id,
            code: schema.counterpartyGroups.code,
          })
          .from(schema.counterpartyGroups)
          .where(inArray(schema.counterpartyGroups.code, customerGroupCodes));

  const customerGroupIdByCustomerId = new Map<string, string>();

  for (const group of groups) {
    const customerId = group.code.slice("customer:".length);
    customerGroupIdByCustomerId.set(customerId, group.id);
  }

  for (const customer of customers) {
    if (!customerGroupIdByCustomerId.has(customer.id)) {
      throw new Error(
        `Customer group is not available after seeding for customer ${customer.id}`,
      );
    }
  }

  return customerGroupIdByCustomerId;
}

export async function ensureSeedCounterpartyMembership(
  db: Database | Transaction,
  counterpartyId: string,
  groupId: string,
): Promise<void> {
  await db
    .insert(schema.counterpartyGroupMemberships)
    .values({
      counterpartyId,
      groupId,
    })
    .onConflictDoNothing({
      target: [
        schema.counterpartyGroupMemberships.counterpartyId,
        schema.counterpartyGroupMemberships.groupId,
      ],
    });
}
