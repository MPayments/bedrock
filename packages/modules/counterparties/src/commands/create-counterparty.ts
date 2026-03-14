import { schema } from "@bedrock/counterparties/schema";

import type { CounterpartiesServiceContext } from "../internal/context";
import {
  enforceCustomerLinkRules,
  ensureCustomerGroupForCustomer,
  replaceMemberships,
  resolveGroupMembershipClassification,
} from "../internal/group-rules";
import {
  CreateCounterpartyInputSchema,
  type Counterparty,
  type CreateCounterpartyInput,
} from "../validation";

export function createCreateCounterpartyHandler(
  context: CounterpartiesServiceContext,
) {
  const { db, log } = context;

  return async function createCounterparty(
    input: CreateCounterpartyInput,
  ): Promise<Counterparty> {
    const validated = CreateCounterpartyInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const groupIds = Array.from(new Set(validated.groupIds));
      if (validated.customerId) {
        const customerGroupId = await ensureCustomerGroupForCustomer(
          tx,
          validated.customerId,
        );
        groupIds.push(customerGroupId);
      }

      const classification = await resolveGroupMembershipClassification(
        tx,
        groupIds,
      );
      enforceCustomerLinkRules(classification, validated.customerId ?? null);

      const [created] = await tx
        .insert(schema.counterparties)
        .values({
          shortName: validated.shortName,
          fullName: validated.fullName,
          kind: validated.kind,
          country: validated.country ?? null,
          externalId: validated.externalId ?? null,
          description: validated.description ?? null,
          customerId: validated.customerId ?? null,
        })
        .returning();

      await replaceMemberships(tx, created!.id, groupIds);

      log.info("Counterparty created", {
        id: created!.id,
        shortName: created!.shortName,
      });

      return {
        ...created!,
        groupIds,
      };
    });
  };
}
