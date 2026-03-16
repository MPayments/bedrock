import { randomUUID } from "node:crypto";

import type {
  CreateCustomerInput,
  Customer as CustomerDto,
  UpdateCustomerInput,
} from "../../contracts";
import {
  CreateCustomerInputSchema,
  UpdateCustomerInputSchema,
} from "../../contracts";
import { Customer } from "../../domain/customer";
import { GroupHierarchy } from "../../domain/group-hierarchy";
import {
  CustomerDeleteConflictError,
  CustomerNotFoundError,
} from "../../errors";
import {
  resolveCreateCustomerProps,
  resolveUpdateCustomerProps,
} from "./inputs";
import type { PartiesServiceContext } from "../shared/context";

function toPublicCustomer(customer: Customer): CustomerDto {
  return customer.toSnapshot();
}

export function createCreateCustomerHandler(context: PartiesServiceContext) {
  const { customers, db, log } = context;

  return async function createCustomer(
    input: CreateCustomerInput,
  ): Promise<CustomerDto> {
    const validated = CreateCustomerInputSchema.parse(input);
    const draft = Customer.create(
      resolveCreateCustomerProps({
        id: randomUUID(),
        values: validated,
      }),
      context.now(),
    );

    return db.transaction(async (tx) => {
      const created = Customer.reconstitute(
        await customers.insertCustomerTx(tx, draft.toSnapshot()),
      );

      await customers.ensureManagedCustomerGroupTx(tx, {
        customerId: created.id,
        displayName: created.toSnapshot().displayName,
      });

      log.info("Customer created", {
        id: created.id,
        displayName: created.toSnapshot().displayName,
      });

      return toPublicCustomer(created);
    });
  };
}

export function createUpdateCustomerHandler(context: PartiesServiceContext) {
  const { customers, db, log } = context;

  return async function updateCustomer(
    id: string,
    input: UpdateCustomerInput,
  ): Promise<CustomerDto> {
    const validated = UpdateCustomerInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const existingSnapshot = await customers.findCustomerSnapshotById(id, tx);
      if (!existingSnapshot) {
        throw new CustomerNotFoundError(id);
      }

      const existing = Customer.reconstitute(existingSnapshot);
      const next = existing.update(
        resolveUpdateCustomerProps(existingSnapshot, validated),
        context.now(),
      );
      const persistedSnapshot = existing.sameState(next)
        ? existingSnapshot
        : await customers.updateCustomerTx(tx, next.toSnapshot());

      if (!persistedSnapshot) {
        throw new CustomerNotFoundError(id);
      }

      if (next.displayNameChangedComparedTo(existing)) {
        await customers.ensureManagedCustomerGroupTx(tx, {
          customerId: id,
          displayName: next.toSnapshot().displayName,
        });
        await customers.renameManagedCustomerGroupTx(tx, {
          customerId: id,
          displayName: next.toSnapshot().displayName,
        });
      }

      log.info("Customer updated", { id });
      return toPublicCustomer(Customer.reconstitute(persistedSnapshot));
    });
  };
}

export function createRemoveCustomerHandler(context: PartiesServiceContext) {
  const { customers, db, documents, log } = context;

  return async function removeCustomer(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const existing = await customers.findCustomerSnapshotById(id, tx);
      if (!existing) {
        throw new CustomerNotFoundError(id);
      }

      const hasDocuments = await documents.hasDocumentsForCustomer(id, tx);
      if (hasDocuments) {
        throw new CustomerDeleteConflictError(id);
      }

      const linkedCounterparties =
        await customers.listCounterpartiesByCustomerId(id, tx);
      const managedGroup = await customers.findManagedCustomerGroup(id, tx);
      const hierarchy = GroupHierarchy.create(
        await customers.listGroupHierarchyNodes(tx),
      );
      const linkedCounterpartyIds = linkedCounterparties.map((row) => row.id);

      if (linkedCounterpartyIds.length > 0) {
        const memberships = await customers.listMembershipRowsByCounterpartyIds(
          linkedCounterpartyIds,
          tx,
        );
        const detachment = hierarchy.planCustomerDetachment({
          customerId: id,
          linkedCounterpartyIds,
          memberships,
        });

        await customers.deleteMembershipsByCounterpartyAndGroupIdsTx(tx, {
          counterpartyIds: detachment.linkedCounterpartyIds,
          groupIds: detachment.removableGroupIds,
        });
        await customers.clearCounterpartyCustomerLinkTx(
          tx,
          detachment.linkedCounterpartyIds,
        );
      }

      if (managedGroup) {
        await customers.deleteCounterpartyGroupsByIdsTx(
          tx,
          hierarchy.listSubtreeIds(managedGroup.id),
        );
      }

      const deleted = await customers.removeCustomerTx(tx, id);
      if (!deleted) {
        throw new CustomerNotFoundError(id);
      }
    });

    log.info("Customer deleted", { id });
  };
}
