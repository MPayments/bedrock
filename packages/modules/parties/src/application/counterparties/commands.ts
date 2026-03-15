import type { PaginatedList } from "@bedrock/shared/core/pagination";

import {
  CreateCounterpartyInputSchema,
  ListCounterpartiesQuerySchema,
  UpdateCounterpartyInputSchema,
  type Counterparty,
  type CreateCounterpartyInput,
  type ListCounterpartiesQuery,
  type UpdateCounterpartyInput,
} from "../../contracts";
import {
  CounterpartyCustomerNotFoundError,
  CounterpartyNotFoundError,
} from "../../errors";
import {
  createGroupNodeMap,
  dedupeIds,
  enforceCustomerLinkRules,
  resolveGroupMembershipClassification,
  withoutCustomerScopedGroups,
} from "../../domain/group-rules";
import type { PartiesServiceContext } from "../shared/context";

async function assertCustomerExists(
  context: PartiesServiceContext,
  customerId: string,
) {
  const existingCustomerIds = await context.parties.listExistingCustomerIds([
    customerId,
  ]);
  if (!existingCustomerIds.includes(customerId)) {
    throw new CounterpartyCustomerNotFoundError(customerId);
  }
}

export function createListCounterpartiesHandler(
  context: PartiesServiceContext,
) {
  const { parties } = context;

  return async function listCounterparties(
    input?: ListCounterpartiesQuery,
  ): Promise<PaginatedList<Counterparty>> {
    const query = ListCounterpartiesQuerySchema.parse(input ?? {});
    return parties.listCounterparties(query);
  };
}

export function createFindCounterpartyByIdHandler(
  context: PartiesServiceContext,
) {
  const { parties } = context;

  return async function findCounterpartyById(id: string): Promise<Counterparty> {
    const counterparty = await parties.findCounterpartyById(id);
    if (!counterparty) {
      throw new CounterpartyNotFoundError(id);
    }

    return counterparty;
  };
}

export function createCreateCounterpartyHandler(
  context: PartiesServiceContext,
) {
  const { db, log, parties } = context;

  return async function createCounterparty(
    input: CreateCounterpartyInput,
  ): Promise<Counterparty> {
    const validated = CreateCounterpartyInputSchema.parse(input);

    return db.transaction(async (tx) => {
      let groupIds = dedupeIds(validated.groupIds);

      if (validated.customerId) {
        await assertCustomerExists(context, validated.customerId);
        const customerGroup = await parties.ensureManagedCustomerGroupTx(tx, {
          customerId: validated.customerId,
          displayName: (await parties.findCustomerById(validated.customerId, tx))!
            .displayName,
        });
        groupIds = dedupeIds([...groupIds, customerGroup.id]);
      }

      const classification = resolveGroupMembershipClassification({
        groupMap: createGroupNodeMap(await parties.listGroupNodes(tx)),
        rawGroupIds: groupIds,
      });
      enforceCustomerLinkRules(classification, validated.customerId ?? null);

      const created = await parties.insertCounterpartyTx(tx, {
        ...validated,
        customerId: validated.customerId ?? null,
      });
      await parties.replaceMembershipsTx(tx, created.id, groupIds);

      log.info("Counterparty created", {
        id: created.id,
        shortName: created.shortName,
      });

      return {
        ...created,
        groupIds,
      };
    });
  };
}

export function createUpdateCounterpartyHandler(
  context: PartiesServiceContext,
) {
  const { db, log, parties } = context;

  return async function updateCounterparty(
    id: string,
    input: UpdateCounterpartyInput,
  ): Promise<Counterparty> {
    const validated = UpdateCounterpartyInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const existing = await parties.findCounterpartyById(id, tx);
      if (!existing) {
        throw new CounterpartyNotFoundError(id);
      }

      const groupMap = createGroupNodeMap(await parties.listGroupNodes(tx));
      const currentGroupIds = dedupeIds(existing.groupIds);
      let nextGroupIds =
        validated.groupIds !== undefined
          ? dedupeIds(validated.groupIds)
          : currentGroupIds;
      const nextCustomerId =
        validated.customerId !== undefined
          ? validated.customerId
          : existing.customerId;

      if (validated.groupIds === undefined && validated.customerId !== undefined) {
        nextGroupIds = withoutCustomerScopedGroups({
          groupMap,
          rawGroupIds: nextGroupIds,
        });
      }

      if (nextCustomerId) {
        await assertCustomerExists(context, nextCustomerId);
        const customer = await parties.findCustomerById(nextCustomerId, tx);
        const customerGroup = await parties.ensureManagedCustomerGroupTx(tx, {
          customerId: nextCustomerId,
          displayName: customer!.displayName,
        });
        nextGroupIds = dedupeIds([...nextGroupIds, customerGroup.id]);
      }

      const classification = resolveGroupMembershipClassification({
        groupMap,
        rawGroupIds: nextGroupIds,
      });
      enforceCustomerLinkRules(classification, nextCustomerId);

      const nextGroupIdSet = new Set(nextGroupIds);
      const membershipChanged =
        currentGroupIds.length !== nextGroupIds.length ||
        currentGroupIds.some((groupId) => !nextGroupIdSet.has(groupId));

      const fields: Partial<{
        shortName: string;
        fullName: string;
        kind: Counterparty["kind"];
        country: Counterparty["country"];
        externalId: string | null;
        description: string | null;
        customerId: string | null;
      }> = {};

      if (validated.shortName !== undefined) {
        fields.shortName = validated.shortName;
      }
      if (validated.fullName !== undefined) {
        fields.fullName = validated.fullName;
      }
      if (validated.kind !== undefined) {
        fields.kind = validated.kind;
      }
      if (validated.country !== undefined) {
        fields.country = validated.country;
      }
      if (validated.externalId !== undefined) {
        fields.externalId = validated.externalId;
      }
      if (validated.description !== undefined) {
        fields.description = validated.description;
      }
      if (validated.customerId !== undefined) {
        fields.customerId = validated.customerId;
      }

      const updated =
        Object.keys(fields).length > 0
          ? await parties.updateCounterpartyTx(tx, id, fields)
          : {
              id: existing.id,
              externalId: existing.externalId,
              customerId: existing.customerId,
              shortName: existing.shortName,
              fullName: existing.fullName,
              description: existing.description,
              country: existing.country,
              kind: existing.kind,
              createdAt: existing.createdAt,
              updatedAt: existing.updatedAt,
            };

      if (!updated) {
        throw new CounterpartyNotFoundError(id);
      }

      if (validated.groupIds !== undefined || membershipChanged) {
        await parties.replaceMembershipsTx(tx, id, nextGroupIds);
      }

      log.info("Counterparty updated", { id });
      return {
        ...updated,
        groupIds: nextGroupIds,
      };
    });
  };
}

export function createRemoveCounterpartyHandler(
  context: PartiesServiceContext,
) {
  const { log, parties } = context;

  return async function removeCounterparty(id: string): Promise<void> {
    const deleted = await parties.removeCounterparty(id);
    if (!deleted) {
      throw new CounterpartyNotFoundError(id);
    }

    log.info("Counterparty deleted", { id });
  };
}
