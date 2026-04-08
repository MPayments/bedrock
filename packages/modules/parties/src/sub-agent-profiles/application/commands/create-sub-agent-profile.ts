import type { ModuleRuntime } from "@bedrock/shared/core";

import { Counterparty } from "../../../counterparties/domain/counterparty";
import { GroupHierarchy } from "../../../shared/domain/group-hierarchy";
import {
  CreateSubAgentProfileInputSchema,
  type CreateSubAgentProfileInput,
} from "../contracts/commands";
import type { SubAgentProfile } from "../contracts/dto";
import type { SubAgentProfilesCommandUnitOfWork } from "../ports/sub-agent-profiles.uow";

export class CreateSubAgentProfileCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: SubAgentProfilesCommandUnitOfWork,
  ) {}

  async execute(input: CreateSubAgentProfileInput): Promise<SubAgentProfile> {
    const validated = CreateSubAgentProfileInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const now = this.runtime.now();
      const hierarchy = GroupHierarchy.create(
        await tx.counterpartyGroupHierarchy.listHierarchyNodes(),
      );
      const draft = Counterparty.create(
        {
          id: this.runtime.generateUuid(),
          customerId: null,
          description: null,
          externalRef: null,
          fullName: validated.fullName?.trim() || validated.shortName.trim(),
          groupIds: [],
          kind: validated.kind,
          country: validated.country ?? null,
          relationshipKind: "external",
          shortName: validated.shortName.trim(),
        },
        {
          hierarchy,
          now,
        },
      );

      const counterparty = await tx.counterparties.save(draft);
      const profile = await tx.subAgentProfiles.create({
        commissionRate: validated.commissionRate,
        counterpartyId: counterparty.id,
        isActive: validated.isActive ?? true,
      });

      const snapshot = counterparty.toSnapshot();

      this.runtime.log.info("Sub-agent profile created", {
        counterpartyId: snapshot.id,
        shortName: snapshot.shortName,
      });

      return {
        commissionRate: profile.commissionRate,
        counterpartyId: snapshot.id,
        country: snapshot.country,
        createdAt: profile.createdAt,
        fullName: snapshot.fullName,
        isActive: profile.isActive,
        kind: snapshot.kind,
        shortName: snapshot.shortName,
        updatedAt: profile.updatedAt,
      };
    });
  }
}
