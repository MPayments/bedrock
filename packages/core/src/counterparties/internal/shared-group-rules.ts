import { eq, inArray } from "drizzle-orm";

import type { Transaction } from "@bedrock/kernel/db/types";

import { schema } from "../schema";

export const TREASURY_ROOT_GROUP_CODE = "treasury";
export const CUSTOMERS_ROOT_GROUP_CODE = "customers";
export const TREASURY_INTERNAL_LEDGER_GROUP_CODE = "treasury_internal_entities";

export function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

export async function ensureCounterpartyRootGroups(
  tx: Transaction,
  onMissingRoots: () => Error,
): Promise<{
  treasuryGroupId: string;
  customersGroupId: string;
}> {
  const defs = [
    {
      code: TREASURY_ROOT_GROUP_CODE,
      name: "Treasury",
      description: "System root for treasury counterparties",
      isSystem: true,
    },
    {
      code: CUSTOMERS_ROOT_GROUP_CODE,
      name: "Customers",
      description: "System root for customer counterparties",
      isSystem: false,
    },
  ] as const;

  for (const def of defs) {
    await tx
      .insert(schema.counterpartyGroups)
      .values({
        code: def.code,
        name: def.name,
        description: def.description,
        parentId: null,
        customerId: null,
        isSystem: def.isSystem,
      })
      .onConflictDoNothing({
        target: schema.counterpartyGroups.code,
      });
  }

  const roots = await tx
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
    throw onMissingRoots();
  }

  return {
    treasuryGroupId,
    customersGroupId,
  };
}

export async function ensureTreasuryInternalLedgerGroup(input: {
  tx: Transaction;
  treasuryGroupId: string;
  onMissingGroup: () => Error;
}): Promise<string> {
  const { tx, treasuryGroupId, onMissingGroup } = input;

  await tx
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

  const [treasuryInternalLedgerGroup] = await tx
    .select({
      id: schema.counterpartyGroups.id,
    })
    .from(schema.counterpartyGroups)
    .where(eq(schema.counterpartyGroups.code, TREASURY_INTERNAL_LEDGER_GROUP_CODE))
    .limit(1);

  if (!treasuryInternalLedgerGroup) {
    throw onMissingGroup();
  }

  return treasuryInternalLedgerGroup.id;
}
