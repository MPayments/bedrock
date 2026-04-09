import type { ModuleRuntime } from "@bedrock/shared/core";

import { validatePaymentIdentifiers } from "../../domain/identifier-schemes";
import { updateRequisiteProviderSnapshot } from "../../domain/requisite-provider";
import {
  UpdateRequisiteProviderInputSchema,
  type UpdateRequisiteProviderInput,
} from "../contracts/commands";
import { RequisiteProviderNotFoundError } from "../errors";
import type { RequisitesCommandUnitOfWork } from "../ports/requisites.uow";

export class UpdateRequisiteProviderCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: RequisitesCommandUnitOfWork,
  ) {}

  async execute(id: string, input: UpdateRequisiteProviderInput) {
    const validated = UpdateRequisiteProviderInputSchema.parse(input);
    if (validated.identifiers !== undefined) {
      validatePaymentIdentifiers({
        owner: "provider",
        identifiers: validated.identifiers,
      });
    }
    if (validated.branches !== undefined) {
      for (const branch of validated.branches) {
        validatePaymentIdentifiers({
          owner: "provider_branch",
          identifiers: branch.identifiers,
        });
      }
    }

    return this.uow.run(async (tx) => {
      const existing = await tx.requisiteProviderStore.findActiveById(id);
      if (!existing) {
        throw new RequisiteProviderNotFoundError(id);
      }

      const updated = await tx.requisiteProviderStore.update(
        updateRequisiteProviderSnapshot(existing, {
          ...validated,
          now: this.runtime.now(),
        }),
      );

      if (!updated) {
        throw new RequisiteProviderNotFoundError(id);
      }

      if (validated.identifiers !== undefined) {
        await tx.requisiteProviderStore.replaceIdentifiers({
          providerId: id,
          items: validated.identifiers,
        });
      }
      if (validated.branches !== undefined) {
        await tx.requisiteProviderStore.replaceBranches({
          providerId: id,
          items: validated.branches,
        });
      }
      const provider = await tx.requisiteProviderStore.findDetailById(id);

      if (!provider) {
        throw new Error(`Requisite provider not found after update: ${id}`);
      }

      this.runtime.log.info("Requisite provider updated", { id });
      return provider;
    });
  }
}
