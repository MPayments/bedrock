import type { ModuleRuntime } from "@bedrock/shared/core";

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

      this.runtime.log.info("Requisite provider updated", { id });
      return updated;
    });
  }
}
