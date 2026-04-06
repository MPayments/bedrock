import type { ModuleRuntime } from "@bedrock/shared/core";

import { ensureManagedCustomerGroup } from "../../../shared/application/managed-customer-group";
import { GroupHierarchy } from "../../../shared/domain/group-hierarchy";
import { Counterparty } from "../../domain/counterparty";
import {
  CreateCounterpartyInputSchema,
  type CreateCounterpartyInput,
} from "../contracts/counterparty.commands";
import {
  CounterpartyCustomerNotFoundError,
  rethrowCounterpartyMembershipDomainError,
} from "../errors";
import { toCounterpartyDto } from "../to-counterparty-dto";
import type { CounterpartiesCommandUnitOfWork } from "../ports/counterparties.uow";

export class CreateCounterpartyCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: CounterpartiesCommandUnitOfWork,
  ) {}

  async execute(input: CreateCounterpartyInput) {
    const validated = CreateCounterpartyInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const now = this.runtime.now();
      let managedGroupId: string | null = null;

      if (validated.customerId) {
        const customer = await tx.customerStore.findById(validated.customerId);
        if (!customer) {
          throw new CounterpartyCustomerNotFoundError(validated.customerId);
        }

        const managedGroup = await ensureManagedCustomerGroup({
          generateUuid: this.runtime.generateUuid,
          groups: tx.counterpartyGroups,
          customerId: validated.customerId,
          displayName: customer.displayName,
          now,
        });
        managedGroupId = managedGroup.toSnapshot().id;
      }

      const hierarchy = GroupHierarchy.create(
        await tx.counterpartyGroupHierarchy.listHierarchyNodes(),
      );

      let draft: Counterparty;
      const shortName =
        validated.kind === "legal_entity"
          ? validated.legalEntity!.profile.shortName
          : validated.shortName!;
      const fullName =
        validated.kind === "legal_entity"
          ? validated.legalEntity!.profile.fullName
          : validated.fullName!;
      const country =
        validated.kind === "legal_entity"
          ? validated.legalEntity!.profile.countryCode
          : validated.country;
      const id = this.runtime.generateUuid();
      try {
        draft = Counterparty.create(
          {
            id,
            externalId: validated.externalId,
            customerId: validated.customerId,
            relationshipKind: validated.relationshipKind,
            shortName,
            fullName,
            description: validated.description,
            country,
            kind: validated.kind,
            groupIds: validated.groupIds,
          },
          {
            hierarchy,
            managedGroupId,
            now,
          },
        );
      } catch (error) {
        rethrowCounterpartyMembershipDomainError(error);
      }

      const created = await tx.counterparties.save(draft);
      const createdSnapshot = created.toSnapshot();
      let legalEntity = null;

      if (validated.kind === "legal_entity" && validated.legalEntity) {
        const profile = await tx.legalEntities.upsertProfile({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          profile: validated.legalEntity.profile,
        });
        const identifiers = await tx.legalEntities.replaceIdentifiers({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          items: validated.legalEntity.identifiers,
        });
        const addresses = await tx.legalEntities.replaceAddresses({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          items: validated.legalEntity.addresses,
        });
        const contacts = await tx.legalEntities.replaceContacts({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          items: validated.legalEntity.contacts,
        });
        const representatives = await tx.legalEntities.replaceRepresentatives({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          items: validated.legalEntity.representatives,
        });
        const licenses = await tx.legalEntities.replaceLicenses({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          items: validated.legalEntity.licenses,
        });

        legalEntity = {
          profile,
          identifiers,
          addresses,
          contacts,
          representatives,
          licenses,
        };
      }

      this.runtime.log.info("Counterparty created", {
        id: createdSnapshot.id,
        shortName: createdSnapshot.shortName,
      });

      return toCounterpartyDto(createdSnapshot, legalEntity);
    });
  }
}
