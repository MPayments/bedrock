import type { ModuleRuntime } from "@bedrock/shared/core";

import { GroupHierarchy } from "../../../shared/domain/group-hierarchy";
import {
  UpdateSubAgentProfileInputSchema,
  type UpdateSubAgentProfileInput,
} from "../contracts/commands";
import type { SubAgentProfile } from "../contracts/dto";
import { SubAgentProfileNotFoundError } from "../errors";
import type { SubAgentProfilesCommandUnitOfWork } from "../ports/sub-agent-profiles.uow";

export class UpdateSubAgentProfileCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: SubAgentProfilesCommandUnitOfWork,
  ) {}

  async execute(
    counterpartyId: string,
    input: UpdateSubAgentProfileInput,
  ): Promise<SubAgentProfile> {
    const validated = UpdateSubAgentProfileInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const [existingCounterparty, existingProfile] = await Promise.all([
        tx.counterparties.findById(counterpartyId),
        tx.subAgentProfiles.findById(counterpartyId),
      ]);

      if (!existingCounterparty || !existingProfile) {
        throw new SubAgentProfileNotFoundError(counterpartyId);
      }

      const snapshot = existingCounterparty.toSnapshot();
      const now = this.runtime.now();
      const hierarchy = GroupHierarchy.create(
        await tx.counterpartyGroupHierarchy.listHierarchyNodes(),
      );
      const nextShortName = validated.shortName?.trim() ?? snapshot.shortName;
      const nextFullName =
        validated.fullName !== undefined
          ? (validated.fullName?.trim() || nextShortName)
          : snapshot.fullName === snapshot.shortName &&
              validated.shortName !== undefined
            ? nextShortName
            : snapshot.fullName;

      const updatedCounterparty = existingCounterparty.update(
        {
          customerId: null,
          description: snapshot.description,
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
          externalId: snapshot.externalId,
          fullName: nextFullName,
          groupIds: snapshot.groupIds,
          kind: validated.kind ?? snapshot.kind,
          country:
            validated.country !== undefined
              ? validated.country
              : snapshot.country,
          relationshipKind: "external",
          shortName: nextShortName,
        },
        {
          hierarchy,
          now,
        },
      );

      const counterparty = await tx.counterparties.save(updatedCounterparty);
      const profile = await tx.subAgentProfiles.update({
        commissionRate: validated.commissionRate,
        counterpartyId,
        isActive: validated.isActive,
      });

      if (!profile) {
        throw new SubAgentProfileNotFoundError(counterpartyId);
      }

      const nextSnapshot = counterparty.toSnapshot();

      this.runtime.log.info("Sub-agent profile updated", {
        counterpartyId,
      });

      return {
        commissionRate: profile.commissionRate,
        counterpartyId: nextSnapshot.id,
        country: nextSnapshot.country,
        createdAt: profile.createdAt,
        fullName: nextSnapshot.fullName,
        isActive: profile.isActive,
        kind: nextSnapshot.kind,
        shortName: nextSnapshot.shortName,
        updatedAt: profile.updatedAt,
      };
    });
  }
}
