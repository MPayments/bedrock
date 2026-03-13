import { and, eq, inArray, sql } from "drizzle-orm";

import type { CustomerLifecycleSyncPort } from "@bedrock/customers";
import type { Transaction } from "@bedrock/persistence";

import {
  ensureCustomerGroupForCustomer,
} from "./internal/group-rules";
import { resolveGroupMembershipClassification } from "./internal/group-rules";
import {
  dedupeIds,
  listCounterpartyGroupSubtreeIds,
} from "./internal/shared-group-rules";
import { schema } from "./schema";

async function removeCustomerGroupForCustomer(
  tx: Transaction,
  customerId: string,
): Promise<void> {
  const [rootCustomerGroup] = await tx
    .select({
      id: schema.counterpartyGroups.id,
    })
    .from(schema.counterpartyGroups)
    .where(eq(schema.counterpartyGroups.code, `customer:${customerId}`))
    .limit(1);

  if (!rootCustomerGroup) {
    return;
  }

  const subtreeGroupIds = await listCounterpartyGroupSubtreeIds(
    tx,
    rootCustomerGroup.id,
  );
  if (subtreeGroupIds.length === 0) {
    return;
  }

  await tx
    .delete(schema.counterpartyGroups)
    .where(inArray(schema.counterpartyGroups.id, subtreeGroupIds));
}

async function detachCounterpartiesFromCustomerTree(
  tx: Transaction,
  customerId: string,
) {
  const linkedCounterparties = await tx
    .select({
      id: schema.counterparties.id,
    })
    .from(schema.counterparties)
    .where(eq(schema.counterparties.customerId, customerId));

  const linkedCounterpartyIds = linkedCounterparties.map((row) => row.id);

  if (linkedCounterpartyIds.length === 0) {
    return;
  }

  const memberships = await tx
    .select({
      counterpartyId: schema.counterpartyGroupMemberships.counterpartyId,
      groupId: schema.counterpartyGroupMemberships.groupId,
    })
    .from(schema.counterpartyGroupMemberships)
    .where(
      inArray(
        schema.counterpartyGroupMemberships.counterpartyId,
        linkedCounterpartyIds,
      ),
    );

  const classification = await resolveGroupMembershipClassification(
    tx,
    memberships.map((membership) => membership.groupId),
  );
  const removableGroupIds = dedupeIds(
    memberships
      .filter((membership) => {
        const rootCode = classification.rootsByGroupId.get(membership.groupId);
        return rootCode === "customers";
      })
      .map((membership) => membership.groupId),
  );

  if (removableGroupIds.length > 0) {
    await tx
      .delete(schema.counterpartyGroupMemberships)
      .where(
        and(
          inArray(
            schema.counterpartyGroupMemberships.counterpartyId,
            linkedCounterpartyIds,
          ),
          inArray(
            schema.counterpartyGroupMemberships.groupId,
            removableGroupIds,
          ),
        ),
      );
  }

  await tx
    .update(schema.counterparties)
    .set({
      customerId: null,
      updatedAt: sql`now()`,
    })
    .where(inArray(schema.counterparties.id, linkedCounterpartyIds));
}

export function createCustomerLifecycleSyncPort(): CustomerLifecycleSyncPort {
  return {
    async onCustomerCreated(tx, input) {
      await ensureCustomerGroupForCustomer(tx, input.customerId);
    },
    async onCustomerRenamed(tx, input) {
      await ensureCustomerGroupForCustomer(tx, input.customerId);

      await tx
        .update(schema.counterpartyGroups)
        .set({
          name: input.displayName,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.counterpartyGroups.code, `customer:${input.customerId}`));
    },
    async onCustomerDeleted(tx, input) {
      await detachCounterpartiesFromCustomerTree(tx, input.customerId);
      await removeCustomerGroupForCustomer(tx, input.customerId);
    },
  };
}
