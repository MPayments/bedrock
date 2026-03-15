import type { PaginatedList } from "@bedrock/shared/core/pagination";

import {
  CreateCustomerInputSchema,
  ListCustomersQuerySchema,
  UpdateCustomerInputSchema,
  type CreateCustomerInput,
  type Customer,
  type ListCustomersQuery,
  type UpdateCustomerInput,
} from "../../contracts";
import {
  CounterpartyCustomerNotFoundError,
  CustomerDeleteConflictError,
  CustomerNotFoundError,
} from "../../errors";
import {
  createGroupNodeMap,
  listGroupSubtreeIds,
  planCustomerDetachment,
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

export function createListCustomersHandler(context: PartiesServiceContext) {
  const { parties } = context;

  return async function listCustomers(
    input?: ListCustomersQuery,
  ): Promise<PaginatedList<Customer>> {
    const query = ListCustomersQuerySchema.parse(input ?? {});
    return parties.listCustomers(query);
  };
}

export function createFindCustomerByIdHandler(context: PartiesServiceContext) {
  const { parties } = context;

  return async function findCustomerById(id: string): Promise<Customer> {
    const customer = await parties.findCustomerById(id);
    if (!customer) {
      throw new CustomerNotFoundError(id);
    }

    return customer;
  };
}

export function createCreateCustomerHandler(context: PartiesServiceContext) {
  const { db, log, parties } = context;

  return async function createCustomer(
    input: CreateCustomerInput,
  ): Promise<Customer> {
    const validated = CreateCustomerInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const created = await parties.insertCustomerTx(tx, validated);

      await parties.ensureManagedCustomerGroupTx(tx, {
        customerId: created.id,
        displayName: created.displayName,
      });

      log.info("Customer created", {
        id: created.id,
        displayName: created.displayName,
      });

      return created;
    });
  };
}

export function createUpdateCustomerHandler(context: PartiesServiceContext) {
  const { db, log, parties } = context;

  return async function updateCustomer(
    id: string,
    input: UpdateCustomerInput,
  ): Promise<Customer> {
    const validated = UpdateCustomerInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const existing = await parties.findCustomerById(id, tx);
      if (!existing) {
        throw new CustomerNotFoundError(id);
      }

      const updated =
        Object.keys(validated).length > 0
          ? await parties.updateCustomerTx(tx, id, validated)
          : existing;

      if (!updated) {
        throw new CustomerNotFoundError(id);
      }

      if (
        validated.displayName !== undefined &&
        validated.displayName !== existing.displayName
      ) {
        await assertCustomerExists(context, id);
        await parties.ensureManagedCustomerGroupTx(tx, {
          customerId: id,
          displayName: updated.displayName,
        });
        await parties.renameManagedCustomerGroupTx(tx, {
          customerId: id,
          displayName: updated.displayName,
        });
      }

      log.info("Customer updated", { id });
      return updated;
    });
  };
}

export function createRemoveCustomerHandler(context: PartiesServiceContext) {
  const { db, documents, log, parties } = context;

  return async function removeCustomer(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const existing = await parties.findCustomerById(id, tx);
      if (!existing) {
        throw new CustomerNotFoundError(id);
      }

      const hasDocuments = await documents.hasDocumentsForCustomer(id, tx);
      if (hasDocuments) {
        throw new CustomerDeleteConflictError(id);
      }

      const linkedCounterparties = await parties.listCounterpartiesByCustomerId(id, tx);
      const managedGroup = await parties.findManagedCustomerGroup(id, tx);
      const groups = await parties.listGroupNodes(tx);
      const groupMap = createGroupNodeMap(groups);
      const linkedCounterpartyIds = linkedCounterparties.map((row) => row.id);

      if (linkedCounterpartyIds.length > 0) {
        const memberships = await parties.listMembershipRowsByCounterpartyIds(
          linkedCounterpartyIds,
          tx,
        );
        const detachment = planCustomerDetachment({
          customerId: id,
          linkedCounterpartyIds,
          memberships,
          groups,
        });

        await parties.deleteMembershipsByCounterpartyAndGroupIdsTx(tx, {
          counterpartyIds: detachment.linkedCounterpartyIds,
          groupIds: detachment.removableGroupIds,
        });
        await parties.clearCounterpartyCustomerLinkTx(
          tx,
          detachment.linkedCounterpartyIds,
        );
      }

      if (managedGroup) {
        const subtreeIds = listGroupSubtreeIds({
          groups: Array.from(groupMap.values()),
          rootGroupId: managedGroup.id,
        });
        await parties.deleteCounterpartyGroupsByIdsTx(tx, subtreeIds);
      }

      const deleted = await parties.removeCustomerTx(tx, id);
      if (!deleted) {
        throw new CustomerNotFoundError(id);
      }
    });

    log.info("Customer deleted", { id });
  };
}
