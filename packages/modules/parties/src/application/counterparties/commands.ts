import { randomUUID } from "node:crypto";

import type { Transaction } from "@bedrock/platform/persistence";

import {
  resolveCreateCounterpartyProps,
  resolveUpdateCounterpartyProps,
} from "./inputs";
import type {
  Counterparty as CounterpartyDto,
  CreateCounterpartyInput,
  UpdateCounterpartyInput,
} from "../../contracts";
import {
  CreateCounterpartyInputSchema,
  UpdateCounterpartyInputSchema,
} from "../../contracts";
import { Counterparty } from "../../domain/counterparty";
import { GroupHierarchy } from "../../domain/group-hierarchy";
import {
  CounterpartyCustomerNotFoundError,
  CounterpartyNotFoundError,
} from "../../errors";
import type { PartiesServiceContext } from "../shared/context";
import { rethrowCounterpartyMembershipDomainError } from "../shared/map-domain-error";

async function assertCustomerExists(
  context: PartiesServiceContext,
  customerId: string,
  tx?: Transaction,
) {
  const existingCustomerIds = await context.customers.listExistingCustomerIds(
    [customerId],
    tx,
  );
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

export function createCreateCounterpartyHandler(
  context: PartiesServiceContext,
) {
  const { counterparties, customers, db, log } = context;

  return async function createCounterparty(
    input: CreateCounterpartyInput,
  ): Promise<CounterpartyDto> {
    const validated = CreateCounterpartyInputSchema.parse(input);

    return db.transaction(async (tx) => {
      let managedGroupId: string | null = null;

      if (validated.customerId) {
        await assertCustomerExists(context, validated.customerId, tx);
        const customer = await customers.findCustomerSnapshotById(
          validated.customerId,
          tx,
        );
        const customerGroup = await customers.ensureManagedCustomerGroupTx(tx, {
          customerId: validated.customerId,
          displayName: customer!.displayName,
        });
        managedGroupId = customerGroup.id;
      }

      const hierarchy = GroupHierarchy.create(
        await counterparties.listGroupHierarchyNodes(tx),
      );

      let draft: Counterparty;
      try {
        draft = Counterparty.create(
          resolveCreateCounterpartyProps({
            id: randomUUID(),
            values: validated,
          }),
          {
            hierarchy,
            managedGroupId,
            now: context.now(),
          },
        );
      } catch (error) {
        rethrowCounterpartyMembershipDomainError(error);
      }

      const createdSnapshot = await counterparties.insertCounterpartyTx(
        tx,
        draft.toSnapshot(),
      );
      await counterparties.replaceMembershipsTx(
        tx,
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
  const { counterparties, customers, db, log } = context;

  return async function updateCounterparty(
    id: string,
    input: UpdateCounterpartyInput,
  ): Promise<CounterpartyDto> {
    const validated = UpdateCounterpartyInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const existingSnapshot =
        await counterparties.findCounterpartySnapshotById(id, tx);
      if (!existingSnapshot) {
        throw new CounterpartyNotFoundError(id);
      }

      const existing = Counterparty.fromSnapshot(existingSnapshot);
      const hierarchy = GroupHierarchy.create(
        await counterparties.listGroupHierarchyNodes(tx),
      );
      const nextInput = resolveUpdateCounterpartyProps(
        existingSnapshot,
        validated,
        hierarchy,
      );
      const nextCustomerId = nextInput.customerId;

      let managedGroupId: string | null = null;
      if (nextCustomerId) {
        await assertCustomerExists(context, nextCustomerId, tx);
        const customer = await customers.findCustomerSnapshotById(
          nextCustomerId,
          tx,
        );
        const customerGroup = await customers.ensureManagedCustomerGroupTx(tx, {
          customerId: nextCustomerId,
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
        : await counterparties.updateCounterpartyTx(tx, next.toSnapshot());

      if (!persistedSnapshot) {
        throw new CounterpartyNotFoundError(id);
      }

      if (
        membershipsChanged(
          existingSnapshot.groupIds,
          next.toSnapshot().groupIds,
        )
      ) {
        await counterparties.replaceMembershipsTx(
          tx,
          id,
          next.toSnapshot().groupIds,
        );
      }

      const updated = Counterparty.fromSnapshot({
        ...persistedSnapshot,
        groupIds: next.toSnapshot().groupIds,
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
