import {
  CreateCounterpartyGroupInputSchema,
  ListCounterpartyGroupsQuerySchema,
  UpdateCounterpartyGroupInputSchema,
  type CounterpartyGroup,
  type CreateCounterpartyGroupInput,
  type ListCounterpartyGroupsQuery,
  type UpdateCounterpartyGroupInput,
} from "../../contracts";
import {
  CounterpartyCustomerNotFoundError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
  CounterpartySystemGroupDeleteError,
} from "../../errors";
import {
  buildManagedCustomerGroupCode,
  createGroupNodeMap,
  isManagedCustomerGroupCode,
  resolvePathToRoot,
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

function toPublicGroup(group: Omit<CounterpartyGroup, "customerLabel">): CounterpartyGroup {
  return group;
}

export function createListCounterpartyGroupsHandler(
  context: PartiesServiceContext,
) {
  const { parties } = context;

  return async function listCounterpartyGroups(
    input?: ListCounterpartyGroupsQuery,
  ): Promise<CounterpartyGroup[]> {
    const query = ListCounterpartyGroupsQuerySchema.parse(input ?? {});
    return parties.listCounterpartyGroups(query);
  };
}

export function createCreateCounterpartyGroupHandler(
  context: PartiesServiceContext,
) {
  const { log, parties } = context;

  return async function createCounterpartyGroup(
    input: CreateCounterpartyGroupInput,
  ): Promise<CounterpartyGroup> {
    const validated = CreateCounterpartyGroupInputSchema.parse(input);
    let customerId = validated.customerId ?? null;

    if (validated.code.startsWith(buildManagedCustomerGroupCode(""))) {
      throw new CounterpartyGroupRuleError(
        "Customer-generated group codes are reserved",
      );
    }

    if (!validated.parentId && customerId) {
      throw new CounterpartyGroupRuleError(
        "Root custom groups cannot have customerId",
      );
    }

    if (validated.parentId) {
      const parent = await parties.findCounterpartyGroupById(validated.parentId);
      if (!parent) {
        throw new CounterpartyGroupNotFoundError(validated.parentId);
      }

      if (parent.customerId) {
        customerId = customerId ?? parent.customerId;
        if (customerId !== parent.customerId) {
          throw new CounterpartyGroupRuleError(
            "Child group customerId must match scoped parent customerId",
          );
        }
      } else if (customerId) {
        throw new CounterpartyGroupRuleError(
          "customerId is allowed only under customer-generated parent groups",
        );
      }
    }

    if (customerId) {
      await assertCustomerExists(context, customerId);
    }

    const created = await parties.insertCounterpartyGroup({
      code: validated.code,
      name: validated.name,
      description: validated.description ?? null,
      parentId: validated.parentId ?? null,
      customerId,
      isSystem: false,
    });

    log.info("Counterparty group created", {
      id: created.id,
      code: created.code,
    });

    return toPublicGroup(created);
  };
}

export function createUpdateCounterpartyGroupHandler(
  context: PartiesServiceContext,
) {
  const { log, parties } = context;

  return async function updateCounterpartyGroup(
    id: string,
    input: UpdateCounterpartyGroupInput,
  ): Promise<CounterpartyGroup> {
    const validated = UpdateCounterpartyGroupInputSchema.parse(input);
    const existing = await parties.findCounterpartyGroupById(id);

    if (!existing) {
      throw new CounterpartyGroupNotFoundError(id);
    }

    const isManagedCustomerGroup = isManagedCustomerGroupCode(existing.code);
    const hasRequestedChanges =
      validated.code !== undefined ||
      validated.name !== undefined ||
      validated.description !== undefined ||
      validated.parentId !== undefined ||
      validated.customerId !== undefined;

    if (isManagedCustomerGroup && hasRequestedChanges) {
      throw new CounterpartyGroupRuleError(
        "Customer-generated groups cannot be modified",
      );
    }

    const nextParentId =
      validated.parentId !== undefined ? validated.parentId : existing.parentId;
    let nextCustomerId =
      validated.customerId !== undefined
        ? validated.customerId
        : existing.customerId;

    if (
      validated.code?.startsWith(buildManagedCustomerGroupCode("")) &&
      !isManagedCustomerGroupCode(existing.code)
    ) {
      throw new CounterpartyGroupRuleError(
        "Customer-generated group codes are reserved",
      );
    }

    if (nextParentId) {
      if (nextParentId === id) {
        throw new CounterpartyGroupRuleError("Group cannot be parent of itself");
      }

      const groupMap = createGroupNodeMap(await parties.listGroupNodes());
      const parent = groupMap.get(nextParentId);
      if (!parent) {
        throw new CounterpartyGroupNotFoundError(nextParentId);
      }

      if (parent.customerId) {
        nextCustomerId = nextCustomerId ?? parent.customerId;
        if (nextCustomerId !== parent.customerId) {
          throw new CounterpartyGroupRuleError(
            "Child group customerId must match scoped parent customerId",
          );
        }
      } else if (nextCustomerId) {
        throw new CounterpartyGroupRuleError(
          "customerId is allowed only under customer-generated parent groups",
        );
      }

      const path = resolvePathToRoot(groupMap, nextParentId);
      if (path.some((group) => group.id === id)) {
        throw new CounterpartyGroupRuleError(
          "Group cannot become a child of its own descendant",
        );
      }
    }

    if (!nextParentId && nextCustomerId && !isManagedCustomerGroupCode(existing.code)) {
      throw new CounterpartyGroupRuleError(
        "Root custom groups cannot have customerId",
      );
    }

    if (
      nextCustomerId &&
      (validated.customerId !== undefined || validated.parentId !== undefined)
    ) {
      await assertCustomerExists(context, nextCustomerId);
    }

    const fields: Partial<{
      code: string;
      name: string;
      description: string | null;
      parentId: string | null;
      customerId: string | null;
    }> = {};

    if (validated.code !== undefined) {
      fields.code = validated.code;
    }
    if (validated.name !== undefined) {
      fields.name = validated.name;
    }
    if (validated.description !== undefined) {
      fields.description = validated.description;
    }
    if (validated.parentId !== undefined) {
      fields.parentId = validated.parentId;
    }
    if (
      validated.customerId !== undefined ||
      validated.parentId !== undefined
    ) {
      fields.customerId = nextCustomerId;
    }

    if (Object.keys(fields).length === 0) {
      return toPublicGroup(existing);
    }

    const updated = await parties.updateCounterpartyGroup(id, fields);
    if (!updated) {
      throw new CounterpartyGroupNotFoundError(id);
    }

    log.info("Counterparty group updated", { id });
    return toPublicGroup(updated);
  };
}

export function createRemoveCounterpartyGroupHandler(
  context: PartiesServiceContext,
) {
  const { db, log, parties } = context;

  return async function removeCounterpartyGroup(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const group = await parties.findCounterpartyGroupById(id, tx);
      if (!group) {
        throw new CounterpartyGroupNotFoundError(id);
      }

      if (group.isSystem || isManagedCustomerGroupCode(group.code)) {
        throw new CounterpartySystemGroupDeleteError(id);
      }

      await parties.reparentCounterpartyChildrenTx(tx, {
        id,
        parentId: group.parentId,
      });
      await parties.removeCounterpartyGroupTx(tx, id);
    });

    log.info("Counterparty group deleted", { id });
  };
}
