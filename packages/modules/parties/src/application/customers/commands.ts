import { randomUUID } from "node:crypto";

import { applyPatch } from "@bedrock/shared/core";

import type {
  CreateCustomerInput,
  Customer as CustomerDto,
  UpdateCustomerInput,
} from "../../contracts";
import {
  CreateCustomerInputSchema,
  UpdateCustomerInputSchema,
} from "../../contracts";
import { Customer, type UpdateCustomerProps } from "../../domain/customer";
import { GroupHierarchy } from "../../domain/group-hierarchy";
import {
  CustomerDeleteConflictError,
  CustomerNotFoundError,
} from "../../errors";
import type { PartiesServiceContext } from "../shared/context";

function toPublicCustomer(customer: Customer): CustomerDto {
  return customer.toSnapshot();
}

export function createCreateCustomerHandler(context: PartiesServiceContext) {
  const { log, transactions } = context;

  return async function createCustomer(
    input: CreateCustomerInput,
  ): Promise<CustomerDto> {
    const validated = CreateCustomerInputSchema.parse(input);
    const draft = Customer.create(
      {
        id: randomUUID(),
        ...validated,
      },
      context.now(),
    );

    return transactions.withTransaction(async ({ customers }) => {
      const created = Customer.fromSnapshot(
        await customers.insertCustomer(draft.toSnapshot()),
      );

      await customers.ensureManagedCustomerGroup({
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
  const { log, transactions } = context;

  return async function updateCustomer(
    id: string,
    input: UpdateCustomerInput,
  ): Promise<CustomerDto> {
    const validated = UpdateCustomerInputSchema.parse(input);

    return transactions.withTransaction(async ({ customers }) => {
      const existingSnapshot = await customers.findCustomerSnapshotById(id);
      if (!existingSnapshot) {
        throw new CustomerNotFoundError(id);
      }

      const existing = Customer.fromSnapshot(existingSnapshot);
      const current: UpdateCustomerProps = existing.toSnapshot();
      const next = existing.update(applyPatch(current, validated), context.now());
      const persistedSnapshot = existing.sameState(next)
        ? existingSnapshot
        : await customers.updateCustomer(next.toSnapshot());

      if (!persistedSnapshot) {
        throw new CustomerNotFoundError(id);
      }

      if (next.displayNameChangedComparedTo(existing)) {
        await customers.ensureManagedCustomerGroup({
          customerId: id,
          displayName: next.toSnapshot().displayName,
        });
        await customers.renameManagedCustomerGroup({
          customerId: id,
          displayName: next.toSnapshot().displayName,
        });
      }

      log.info("Customer updated", { id });
      return toPublicCustomer(Customer.fromSnapshot(persistedSnapshot));
    });
  };
}

export function createRemoveCustomerHandler(context: PartiesServiceContext) {
  const { log, transactions } = context;

  return async function removeCustomer(id: string): Promise<void> {
    await transactions.withTransaction(async ({ customers, documents }) => {
      const existing = await customers.findCustomerSnapshotById(id);
      if (!existing) {
        throw new CustomerNotFoundError(id);
      }

      const hasDocuments = await documents.hasDocumentsForCustomer(id);
      if (hasDocuments) {
        throw new CustomerDeleteConflictError(id);
      }

      const linkedCounterparties =
        await customers.listCounterpartiesByCustomerId(id);
      const managedGroup = await customers.findManagedCustomerGroup(id);
      const hierarchy = GroupHierarchy.create(
        await customers.listGroupHierarchyNodes(),
      );
      const linkedCounterpartyIds = linkedCounterparties.map((row) => row.id);

      if (linkedCounterpartyIds.length > 0) {
        const memberships = await customers.listMembershipRowsByCounterpartyIds(
          linkedCounterpartyIds,
        );
        const detachment = hierarchy.planCustomerDetachment({
          customerId: id,
          linkedCounterpartyIds,
          memberships,
        });

        await customers.deleteMembershipsByCounterpartyAndGroupIds({
          counterpartyIds: detachment.linkedCounterpartyIds,
          groupIds: detachment.removableGroupIds,
        });
        await customers.clearCounterpartyCustomerLink(
          detachment.linkedCounterpartyIds,
        );
      }

      if (managedGroup) {
        await customers.deleteCounterpartyGroupsByIds(
          hierarchy.listSubtreeIds(managedGroup.id),
        );
      }

      const deleted = await customers.removeCustomer(id);
      if (!deleted) {
        throw new CustomerNotFoundError(id);
      }
    });

    log.info("Customer deleted", { id });
  };
}
