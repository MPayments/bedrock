import { randomUUID } from "node:crypto";

import { applyPatch } from "@bedrock/shared/core";

import type {
  Counterparty as CounterpartyDto,
  CreateCounterpartyInput,
  UpdateCounterpartyInput,
} from "../../contracts";
import {
  CreateCounterpartyInputSchema,
  UpdateCounterpartyInputSchema,
} from "../../contracts";
import {
  Counterparty,
  type CounterpartySnapshot,
  type UpdateCounterpartyProps,
} from "../../domain/counterparty";
import { GroupHierarchy } from "../../domain/group-hierarchy";
import {
  CounterpartyCustomerNotFoundError,
  CounterpartyNotFoundError,
} from "../../errors";
import type { CustomersCommandTxRepository } from "../customers/ports";
import type { PartiesServiceContext } from "../shared/context";
import { rethrowCounterpartyMembershipDomainError } from "../shared/map-domain-error";

async function assertCustomerExists(
  customers: Pick<CustomersCommandTxRepository, "listExistingCustomerIds">,
  customerId: string,
) {
  const existingCustomerIds = await customers.listExistingCustomerIds([customerId]);
  if (!existingCustomerIds.includes(customerId)) {
    throw new CounterpartyCustomerNotFoundError(customerId);
  }
}

function toPublicCounterparty(counterparty: Counterparty): CounterpartyDto {
  return counterparty.toSnapshot();
}

function membershipsChanged(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length !== right.length ||
    left.some((groupId, index) => groupId !== right[index])
  );
}

function resolveCounterpartyUpdateProps(
  snapshot: CounterpartySnapshot,
  patch: Partial<UpdateCounterpartyProps>,
  hierarchy: GroupHierarchy,
): UpdateCounterpartyProps {
  const next: UpdateCounterpartyProps = applyPatch(snapshot, patch);
  const customerId =
    patch.customerId !== undefined ? patch.customerId : snapshot.customerId;
  const groupIds =
    patch.groupIds !== undefined
      ? patch.groupIds
      : patch.customerId !== undefined
        ? hierarchy.withoutCustomerScopedGroups(snapshot.groupIds)
        : snapshot.groupIds;

  return {
    ...next,
    customerId,
    groupIds,
  };
}

export function createCreateCounterpartyHandler(
  context: PartiesServiceContext,
) {
  const { log, transactions } = context;

  return async function createCounterparty(
    input: CreateCounterpartyInput,
  ): Promise<CounterpartyDto> {
    const validated = CreateCounterpartyInputSchema.parse(input);

    return transactions.withTransaction(async ({ counterparties, customers }) => {
      let managedGroupId: string | null = null;

      if (validated.customerId) {
        await assertCustomerExists(customers, validated.customerId);
        const customer = await customers.findCustomerSnapshotById(
          validated.customerId,
        );
        const customerGroup = await customers.ensureManagedCustomerGroup({
          customerId: validated.customerId,
          displayName: customer!.displayName,
        });
        managedGroupId = customerGroup.id;
      }

      const hierarchy = GroupHierarchy.create(
        await counterparties.listGroupHierarchyNodes(),
      );

      let draft: Counterparty;
      try {
        draft = Counterparty.create(
          {
            id: randomUUID(),
            ...validated,
          },
          {
            hierarchy,
            managedGroupId,
            now: context.now(),
          },
        );
      } catch (error) {
        rethrowCounterpartyMembershipDomainError(error);
      }

      const createdSnapshot = await counterparties.insertCounterparty(
        draft.toSnapshot(),
      );
      await counterparties.replaceMemberships(
        createdSnapshot.id,
        draft.toSnapshot().groupIds,
      );

      const created = Counterparty.fromSnapshot({
        ...createdSnapshot,
        groupIds: draft.toSnapshot().groupIds,
      });

      log.info("Counterparty created", {
        id: created.id,
        shortName: created.toSnapshot().shortName,
      });

      return toPublicCounterparty(created);
    });
  };
}

export function createUpdateCounterpartyHandler(
  context: PartiesServiceContext,
) {
  const { log, transactions } = context;

  return async function updateCounterparty(
    id: string,
    input: UpdateCounterpartyInput,
  ): Promise<CounterpartyDto> {
    const validated = UpdateCounterpartyInputSchema.parse(input);

    return transactions.withTransaction(async ({ counterparties, customers }) => {
      const existingSnapshot =
        await counterparties.findCounterpartySnapshotById(id);
      if (!existingSnapshot) {
        throw new CounterpartyNotFoundError(id);
      }

      const existing = Counterparty.fromSnapshot(existingSnapshot);
      const hierarchy = GroupHierarchy.create(
        await counterparties.listGroupHierarchyNodes(),
      );
      const nextInput = resolveCounterpartyUpdateProps(
        existingSnapshot,
        validated,
        hierarchy,
      );

      let managedGroupId: string | null = null;
      if (nextInput.customerId) {
        await assertCustomerExists(customers, nextInput.customerId);
        const customer = await customers.findCustomerSnapshotById(
          nextInput.customerId,
        );
        const customerGroup = await customers.ensureManagedCustomerGroup({
          customerId: nextInput.customerId,
          displayName: customer!.displayName,
        });
        managedGroupId = customerGroup.id;
      }

      let next: Counterparty;
      try {
        next = existing.update(nextInput, {
          hierarchy,
          managedGroupId,
          now: context.now(),
        });
      } catch (error) {
        rethrowCounterpartyMembershipDomainError(error);
      }

      const persistedSnapshot = existing.sameState(next)
        ? existingSnapshot
        : await counterparties.updateCounterparty(next.toSnapshot());

      if (!persistedSnapshot) {
        throw new CounterpartyNotFoundError(id);
      }

      const nextSnapshot = next.toSnapshot();
      if (
        membershipsChanged(
          existingSnapshot.groupIds,
          nextSnapshot.groupIds,
        )
      ) {
        await counterparties.replaceMemberships(id, nextSnapshot.groupIds);
      }

      const updated = Counterparty.fromSnapshot({
        ...persistedSnapshot,
        groupIds: nextSnapshot.groupIds,
      });

      log.info("Counterparty updated", { id });
      return toPublicCounterparty(updated);
    });
  };
}

export function createRemoveCounterpartyHandler(
  context: PartiesServiceContext,
) {
  const { counterparties, log } = context;

  return async function removeCounterparty(id: string): Promise<void> {
    const deleted = await counterparties.removeCounterparty(id);
    if (!deleted) {
      throw new CounterpartyNotFoundError(id);
    }

    log.info("Counterparty deleted", { id });
  };
}
