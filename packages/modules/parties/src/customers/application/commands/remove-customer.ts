import type { ModuleRuntime } from "@bedrock/shared/core";

import type { PartyRegistryDocumentsReadPort } from "../../../shared/application/documents-read.port";
import { GroupHierarchy } from "../../../shared/domain/group-hierarchy";
import {
  CustomerDeleteConflictError,
  CustomerNotFoundError,
} from "../errors";
import type { CustomerReads } from "../ports/customer.reads";
import type { CustomersCommandUnitOfWork } from "../ports/customers.uow";

export class RemoveCustomerCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly customerReads: CustomerReads,
    private readonly documents: PartyRegistryDocumentsReadPort,
    private readonly unitOfWork: CustomersCommandUnitOfWork,
  ) {}

  async execute(id: string) {
    const existing = await this.customerReads.findById(id);
    if (!existing) {
      throw new CustomerNotFoundError(id);
    }

    const hasDocuments = await this.documents.hasDocumentsForCustomer(id);
    if (hasDocuments) {
      throw new CustomerDeleteConflictError(id);
    }

    await this.unitOfWork.run(async (tx) => {
      const now = this.runtime.now();
      const linkedCounterparties = await tx.counterparties.findByCustomerId(id);
      const managedGroup = await tx.counterpartyGroups.findManagedCustomerGroup(
        id,
      );
      const hierarchy = GroupHierarchy.create(
        await tx.counterpartyGroupHierarchy.listHierarchyNodes(),
      );

      for (const counterparty of linkedCounterparties) {
        const detached = counterparty.detachCustomer({
          hierarchy,
          now,
        });

        if (!counterparty.sameState(detached)) {
          await tx.counterparties.save(detached);
        }
      }

      if (managedGroup) {
        for (const groupId of hierarchy.listSubtreeIds(managedGroup.id)) {
          await tx.counterpartyGroups.remove(groupId);
        }
      }

      const deleted = await tx.customerStore.remove(id);
      if (!deleted) {
        throw new CustomerNotFoundError(id);
      }
    });

    this.runtime.log.info("Customer deleted", { id });
  }
}
