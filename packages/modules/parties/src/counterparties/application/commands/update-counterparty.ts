import type { ModuleRuntime } from "@bedrock/shared/core";
import { applyPatch } from "@bedrock/shared/core/patch";

import { ensureManagedCustomerGroup } from "../../../shared/application/managed-customer-group";
import { GroupHierarchy } from "../../../shared/domain/group-hierarchy";
import type { UpdateCounterpartyProps } from "../../domain/counterparty";
import {
  type UpdateCounterpartyInput,
  UpdateCounterpartyInputSchema,
} from "../contracts/counterparty.commands";
import {
  CounterpartyCustomerNotFoundError,
  CounterpartyNotFoundError,
  rethrowCounterpartyMembershipDomainError,
} from "../errors";
import type { CounterpartiesCommandUnitOfWork } from "../ports/counterparties.uow";

export class UpdateCounterpartyCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: CounterpartiesCommandUnitOfWork,
  ) {}

  async execute(id: string, input: UpdateCounterpartyInput) {
    const validated = UpdateCounterpartyInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const now = this.runtime.now();
      const existing = await tx.counterparties.findById(id);
      if (!existing) {
        throw new CounterpartyNotFoundError(id);
      }

      const snapshot = existing.toSnapshot();
      const hierarchy = GroupHierarchy.create(
        await tx.counterpartyGroupHierarchy.listHierarchyNodes(),
      );
      const patchInput = applyPatch(
        {
          externalId: snapshot.externalId,
          customerId: snapshot.customerId,
          relationshipKind: snapshot.relationshipKind,
          shortName: snapshot.shortName,
          fullName: snapshot.fullName,
          orgNameI18n: snapshot.orgNameI18n,
          orgType: snapshot.orgType,
          orgTypeI18n: snapshot.orgTypeI18n,
          directorName: snapshot.directorName,
          directorNameI18n: snapshot.directorNameI18n,
          position: snapshot.position,
          positionI18n: snapshot.positionI18n,
          directorBasis: snapshot.directorBasis,
          directorBasisI18n: snapshot.directorBasisI18n,
          address: snapshot.address,
          addressI18n: snapshot.addressI18n,
          email: snapshot.email,
          phone: snapshot.phone,
          inn: snapshot.inn,
          kpp: snapshot.kpp,
          ogrn: snapshot.ogrn,
          oktmo: snapshot.oktmo,
          okpo: snapshot.okpo,
          description: snapshot.description,
          country: snapshot.country,
          kind: snapshot.kind,
          groupIds: snapshot.groupIds,
        },
        validated,
      );
      const nextInput: UpdateCounterpartyProps = {
        ...patchInput,
        customerId:
          validated.customerId !== undefined
            ? validated.customerId
            : snapshot.customerId,
        groupIds:
          validated.groupIds ??
          (validated.customerId !== undefined
            ? hierarchy.withoutCustomerScopedGroups(snapshot.groupIds)
            : snapshot.groupIds),
      };

      let managedGroupId: string | null = null;
      if (nextInput.customerId) {
        const customer = await tx.customerStore.findById(nextInput.customerId);
        if (!customer) {
          throw new CounterpartyCustomerNotFoundError(nextInput.customerId);
        }

        const managedGroup = await ensureManagedCustomerGroup({
          generateUuid: this.runtime.generateUuid,
          groups: tx.counterpartyGroups,
          customerId: nextInput.customerId,
          displayName: customer.displayName,
          now,
        });
        managedGroupId = managedGroup.toSnapshot().id;
      }

      let next;
      try {
        next = existing.update(nextInput, {
          hierarchy,
          managedGroupId,
          now,
        });
      } catch (error) {
        rethrowCounterpartyMembershipDomainError(error);
      }

      const updated = await tx.counterparties.save(next);

      this.runtime.log.info("Counterparty updated", { id });
      return updated.toSnapshot();
    });
  }
}
