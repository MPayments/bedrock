import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  createRequisiteProviderSnapshot,
  type RequisiteProviderSnapshot,
} from "../../domain/requisite-provider";
import { validatePaymentIdentifiers } from "../../domain/identifier-schemes";
import {
  CreateRequisiteProviderInputSchema,
  type CreateRequisiteProviderInput,
} from "../contracts/commands";
import type { RequisitesCommandUnitOfWork } from "../ports/requisites.uow";

export class CreateRequisiteProviderCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: RequisitesCommandUnitOfWork,
  ) {}

  async execute(input: CreateRequisiteProviderInput) {
    const validated = CreateRequisiteProviderInputSchema.parse(input);
    validatePaymentIdentifiers({
      owner: "provider",
      identifiers: validated.identifiers,
    });
    for (const branch of validated.branches) {
      validatePaymentIdentifiers({
        owner: "provider_branch",
        identifiers: branch.identifiers,
      });
    }

    return this.uow.run(async (tx) => {
      const created = await tx.requisiteProviderStore.create(
        createRequisiteProviderSnapshot({
          id: this.runtime.generateUuid(),
          now: this.runtime.now(),
          kind: validated.kind,
          legalName: validated.legalName,
          legalNameI18n: validated.legalNameI18n,
          displayName: validated.displayName,
          displayNameI18n: validated.displayNameI18n,
          description: validated.description,
          country: validated.country,
          website: validated.website,
        }) satisfies RequisiteProviderSnapshot,
      );

      await tx.requisiteProviderStore.replaceIdentifiers({
        providerId: created.id,
        items: validated.identifiers,
      });
      await tx.requisiteProviderStore.replaceBranches({
        providerId: created.id,
        items: validated.branches,
      });
      const provider = await tx.requisiteProviderStore.findDetailById(created.id);

      if (!provider) {
        throw new Error(`Requisite provider not found after create: ${created.id}`);
      }

      this.runtime.log.info("Requisite provider created", {
        id: provider.id,
        displayName: provider.displayName,
      });

      return provider;
    });
  }
}
