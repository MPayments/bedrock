import { and, eq, inArray, sql } from "drizzle-orm";

import { schema as counterpartiesSchema } from "@bedrock/parties/counterparties/schema";
import type { Transaction } from "@bedrock/kernel/db/types";

import { resolveGroupMembershipClassification } from "../../internal/group-rules";
import {
  dedupeIds,
  ensureCustomerGroupForCustomer as ensureCustomerGroupForCustomerShared,
  listCounterpartyGroupSubtreeIds,
} from "../../internal/shared-group-rules";
import { CustomerInvariantError } from "../errors";

const schema = counterpartiesSchema;

export async function ensureCustomerGroupForCustomer(
  tx: Transaction,
  customerId: string,
): Promise<string> {
  return ensureCustomerGroupForCustomerShared({
    tx,
    customerId,
    onMissingCustomer: () =>
      new CustomerInvariantError(`Customer not found: ${customerId}`),
    onMissingGroup: () =>
      new CustomerInvariantError(
        `Failed to ensure customer group for customer ${customerId}`,
      ),
    buildGroupName: (displayName) => displayName,
  });
}

export async function removeCustomerGroupForCustomer(
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

export async function detachCounterpartiesFromCustomerTree(
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

  if (linkedCounterpartyIds.length > 0) {
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
}
