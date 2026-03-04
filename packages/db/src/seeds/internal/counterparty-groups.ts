import { eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "../../client";
import { schema } from "../../schema";

const TREASURY_ROOT_GROUP_CODE = "treasury";
const CUSTOMERS_ROOT_GROUP_CODE = "customers";
export const TREASURY_INTERNAL_LEDGER_GROUP_CODE = "treasury_internal_entities";

interface SeedCustomer {
  id: string;
  displayName: string;
}

export async function ensureSeedSystemGroups(
  db: Database | Transaction,
): Promise<{
  treasuryGroupId: string;
  customersGroupId: string;
  treasuryInternalLedgerGroupId: string;
}> {
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

  const roots = await db
    .select({
      id: schema.counterpartyGroups.id,
      code: schema.counterpartyGroups.code,
    })
    .from(schema.counterpartyGroups)
    .where(
      inArray(schema.counterpartyGroups.code, [
        TREASURY_ROOT_GROUP_CODE,
        CUSTOMERS_ROOT_GROUP_CODE,
      ]),
    );

  const treasuryGroupId = roots.find(
    (group) => group.code === TREASURY_ROOT_GROUP_CODE,
  )?.id;
  const customersGroupId = roots.find(
    (group) => group.code === CUSTOMERS_ROOT_GROUP_CODE,
  )?.id;
  if (!treasuryGroupId || !customersGroupId) {
    throw new Error("System root groups are not available after seeding");
  }

  await db
    .insert(schema.counterpartyGroups)
    .values({
      code: TREASURY_INTERNAL_LEDGER_GROUP_CODE,
      name: "Treasury Internal Ledger Entities",
      description: "System subtree for internal ledger-owning entities",
      parentId: treasuryGroupId,
      customerId: null,
      isSystem: true,
    })
    .onConflictDoUpdate({
      target: schema.counterpartyGroups.code,
      set: {
        name: "Treasury Internal Ledger Entities",
        description: "System subtree for internal ledger-owning entities",
        parentId: treasuryGroupId,
        customerId: null,
        isSystem: true,
      },
    });

  const [treasuryInternalLedgerGroup] = await db
    .select({ id: schema.counterpartyGroups.id })
    .from(schema.counterpartyGroups)
    .where(
      eq(schema.counterpartyGroups.code, TREASURY_INTERNAL_LEDGER_GROUP_CODE),
    )
    .limit(1);
  if (!treasuryInternalLedgerGroup) {
    throw new Error(
      "Treasury internal ledger group is not available after seeding",
    );
  }

  return {
    treasuryGroupId,
    customersGroupId,
    treasuryInternalLedgerGroupId: treasuryInternalLedgerGroup.id,
  };
}

export async function ensureSeedCustomerGroups(
  db: Database | Transaction,
  customers: readonly SeedCustomer[],
): Promise<Map<string, string>> {
  const customerGroupCodes = customers.map(
    (customer) => `customer:${customer.id}`,
  );
  const { customersGroupId } = await ensureSeedSystemGroups(db);

  for (const customer of customers) {
    await db
      .insert(schema.counterpartyGroups)
      .values({
        code: `customer:${customer.id}`,
        name: `Customer ${customer.displayName}`,
        description: "Auto-created customer group",
        parentId: customersGroupId,
        customerId: customer.id,
        isSystem: false,
      })
      .onConflictDoUpdate({
        target: schema.counterpartyGroups.code,
        set: {
          name: `Customer ${customer.displayName}`,
          description: "Auto-created customer group",
          parentId: customersGroupId,
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
