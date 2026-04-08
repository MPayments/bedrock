import type { ModuleRuntime } from "@bedrock/shared/core";

import { validatePartyProfileBundleInput } from "../../../party-profiles/application/validation";
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
import type { CounterpartiesCommandUnitOfWork } from "../ports/counterparties.uow";
import { toCounterpartyDto } from "../to-counterparty-dto";

export class CreateCounterpartyCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: CounterpartiesCommandUnitOfWork,
  ) {}

  async execute(input: CreateCounterpartyInput) {
    const validated = CreateCounterpartyInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const now = this.runtime.now();
      const partyProfileInput = validated.partyProfile;
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
          name: customer.name,
          now,
        });
        managedGroupId = managedGroup.toSnapshot().id;
      }

      const hierarchy = GroupHierarchy.create(
        await tx.counterpartyGroupHierarchy.listHierarchyNodes(),
      );

      let draft: Counterparty;
      if (partyProfileInput) {
        validatePartyProfileBundleInput(partyProfileInput, validated.kind);
      }

      const shortName =
        partyProfileInput?.profile.shortName ?? validated.shortName!;
      const fullName =
        partyProfileInput?.profile.fullName ?? validated.fullName!;
      const country =
        partyProfileInput?.profile.countryCode ?? validated.country;
      const id = this.runtime.generateUuid();
      try {
        draft = Counterparty.create(
          {
            id,
            externalRef: validated.externalRef,
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
      let partyProfile = null;

      if (partyProfileInput) {
        const profile = await tx.partyProfiles.upsertProfile({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          profile: partyProfileInput.profile,
        });
        const identifiers = await tx.partyProfiles.replaceIdentifiers({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          items: partyProfileInput.identifiers,
        });
        const address = await tx.partyProfiles.replaceAddress({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          item: partyProfileInput.address,
        });
        const contacts = await tx.partyProfiles.replaceContacts({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          items: partyProfileInput.contacts,
        });
        const representatives = await tx.partyProfiles.replaceRepresentatives({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          items: partyProfileInput.representatives,
        });
        const licenses = await tx.partyProfiles.replaceLicenses({
          ownerType: "counterparty",
          ownerId: createdSnapshot.id,
          items: partyProfileInput.licenses,
        });

        partyProfile = {
          profile,
          identifiers,
          address,
          contacts,
          representatives,
          licenses,
        };
      }

      this.runtime.log.info("Counterparty created", {
        id: createdSnapshot.id,
        shortName: createdSnapshot.shortName,
      });

      return toCounterpartyDto(createdSnapshot, partyProfile);
    });
  }
}
