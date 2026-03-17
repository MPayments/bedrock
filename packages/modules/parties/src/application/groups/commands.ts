import { randomUUID } from "node:crypto";

import type {
  CounterpartyGroup as CounterpartyGroupDto,
  CreateCounterpartyGroupInput,
  UpdateCounterpartyGroupInput,
} from "../../contracts";
import {
  CreateCounterpartyGroupInputSchema,
  UpdateCounterpartyGroupInputSchema,
} from "../../contracts";
import { CounterpartyGroup } from "../../domain/counterparty-group";
import { GroupHierarchy } from "../../domain/group-hierarchy";
import {
  CounterpartyCustomerNotFoundError,
  CounterpartyGroupNotFoundError,
} from "../../errors";
import type { PartiesServiceContext } from "../shared/context";
import { rethrowCounterpartyGroupDomainError } from "../shared/map-domain-error";

async function assertCustomerExists(
  context: PartiesServiceContext,
  customerId: string,
) {
  const existingCustomer = await context.customerQueries.findCustomerById(
    customerId,
  );
  if (!existingCustomer) {
    throw new CounterpartyCustomerNotFoundError(customerId);
  }
}

function toPublicGroup(group: CounterpartyGroup): CounterpartyGroupDto {
  return group.toSnapshot();
}

export function createCreateCounterpartyGroupHandler(
  context: PartiesServiceContext,
) {
  const { groups, log } = context;

  return async function createCounterpartyGroup(
    input: CreateCounterpartyGroupInput,
  ): Promise<CounterpartyGroupDto> {
    const validated = CreateCounterpartyGroupInputSchema.parse(input);

    if (validated.customerId) {
      await assertCustomerExists(context, validated.customerId);
    }

    const parent = validated.parentId
      ? await groups.findCounterpartyGroupSnapshotById(validated.parentId)
      : null;

    let draft: CounterpartyGroup;
    try {
      draft = CounterpartyGroup.create(
        {
          id: randomUUID(),
          isSystem: false,
          ...validated,
        },
        {
          parent,
          now: context.now(),
        },
      );
    } catch (error) {
      rethrowCounterpartyGroupDomainError(error);
    }

    const created = CounterpartyGroup.fromSnapshot(
      await groups.insertCounterpartyGroup(draft.toSnapshot()),
    );

    log.info("Counterparty group created", {
      id: created.id,
      code: created.toSnapshot().code,
    });

    return toPublicGroup(created);
  };
}

export function createUpdateCounterpartyGroupHandler(
  context: PartiesServiceContext,
) {
  const { groups, log } = context;

  return async function updateCounterpartyGroup(
    id: string,
    input: UpdateCounterpartyGroupInput,
  ): Promise<CounterpartyGroupDto> {
    const validated = UpdateCounterpartyGroupInputSchema.parse(input);
    const existingSnapshot = await groups.findCounterpartyGroupSnapshotById(id);

    if (!existingSnapshot) {
      throw new CounterpartyGroupNotFoundError(id);
    }

    const hierarchy = GroupHierarchy.create(
      await groups.listGroupHierarchyNodes(),
    );

    let next: CounterpartyGroup;
    try {
      next = CounterpartyGroup.fromSnapshot(existingSnapshot).update(
        validated,
        {
          hierarchy,
          now: context.now(),
        },
      );
    } catch (error) {
      rethrowCounterpartyGroupDomainError(error);
    }

    if (
      (validated.customerId !== undefined || validated.parentId !== undefined) &&
      next.toSnapshot().customerId
    ) {
      await assertCustomerExists(context, next.toSnapshot().customerId!);
    }

    const updatedSnapshot = CounterpartyGroup.fromSnapshot(
      existingSnapshot,
    ).sameState(next)
      ? existingSnapshot
      : await groups.updateCounterpartyGroup(next.toSnapshot());

    if (!updatedSnapshot) {
      throw new CounterpartyGroupNotFoundError(id);
    }

    const updated = CounterpartyGroup.fromSnapshot(updatedSnapshot);
    log.info("Counterparty group updated", { id });
    return toPublicGroup(updated);
  };
}

export function createRemoveCounterpartyGroupHandler(
  context: PartiesServiceContext,
) {
  const { log, transactions } = context;

  return async function removeCounterpartyGroup(id: string): Promise<void> {
    await transactions.withTransaction(async ({ groups }) => {
      const groupSnapshot = await groups.findCounterpartyGroupSnapshotById(id);
      if (!groupSnapshot) {
        throw new CounterpartyGroupNotFoundError(id);
      }

      try {
        CounterpartyGroup.fromSnapshot(groupSnapshot).assertRemovable();
      } catch (error) {
        rethrowCounterpartyGroupDomainError(error);
      }

      await groups.reparentCounterpartyChildren({
        id,
        parentId: groupSnapshot.parentId,
      });
      await groups.removeCounterpartyGroup(id);
    });

    log.info("Counterparty group deleted", { id });
  };
}
