import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/counterparties/schema";

import { CounterpartyNotFoundError } from "../errors";
import type { CounterpartiesServiceContext } from "../internal/context";
import {
  enforceCustomerLinkRules,
  ensureCustomerGroupForCustomer,
  readMembershipIds,
  replaceMemberships,
  resolveGroupMembershipClassification,
  withoutRootGroups,
} from "../internal/group-rules";
import {
  UpdateCounterpartyInputSchema,
  type Counterparty,
  type UpdateCounterpartyInput,
} from "../validation";

export function createUpdateCounterpartyHandler(
  context: CounterpartiesServiceContext,
) {
  const { db, log } = context;

  return async function updateCounterparty(
    id: string,
    input: UpdateCounterpartyInput,
  ): Promise<Counterparty> {
    const validated = UpdateCounterpartyInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.counterparties)
        .where(eq(schema.counterparties.id, id))
        .limit(1);

      if (!existing) {
        throw new CounterpartyNotFoundError(id);
      }

      const currentGroupIds = Array.from(
        new Set(await readMembershipIds(tx, id)),
      );
      let nextGroupIds = validated.groupIds
        ? Array.from(new Set(validated.groupIds))
        : currentGroupIds;
      const nextCustomerId =
        validated.customerId !== undefined
          ? validated.customerId
          : existing.customerId;

      if (
        validated.groupIds === undefined &&
        validated.customerId !== undefined
      ) {
        nextGroupIds = await withoutRootGroups(tx, nextGroupIds);
      }

      if (nextCustomerId) {
        const customerGroupId = await ensureCustomerGroupForCustomer(
          tx,
          nextCustomerId,
        );
        nextGroupIds = Array.from(new Set([...nextGroupIds, customerGroupId]));
      }

      const nextGroupIdsSet = new Set(nextGroupIds);
      const membershipChanged =
        currentGroupIds.length !== nextGroupIds.length ||
        currentGroupIds.some((groupId) => !nextGroupIdsSet.has(groupId));

      const classification = await resolveGroupMembershipClassification(
        tx,
        nextGroupIds,
      );
      enforceCustomerLinkRules(classification, nextCustomerId);

      const fields: Record<string, unknown> = {};

      if (validated.shortName !== undefined) {
        fields.shortName = validated.shortName;
      }
      if (validated.fullName !== undefined) {
        fields.fullName = validated.fullName;
      }
      if (validated.kind !== undefined) fields.kind = validated.kind;
      if (validated.country !== undefined) fields.country = validated.country;
      if (validated.externalId !== undefined) {
        fields.externalId = validated.externalId;
      }
      if (validated.description !== undefined) {
        fields.description = validated.description;
      }
      if (validated.customerId !== undefined) {
        fields.customerId = validated.customerId;
      }

      let row = existing;

      if (Object.keys(fields).length > 0) {
        fields.updatedAt = sql`now()`;

        const [updated] = await tx
          .update(schema.counterparties)
          .set(fields)
          .where(eq(schema.counterparties.id, id))
          .returning();

        if (!updated) {
          throw new CounterpartyNotFoundError(id);
        }

        row = updated;
      }

      if (validated.groupIds !== undefined || membershipChanged) {
        await replaceMemberships(tx, id, nextGroupIds);
      }

      log.info("Counterparty updated", { id });

      return {
        ...row,
        groupIds: nextGroupIds,
      };
    });
  };
}
