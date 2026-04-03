import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  createRequisiteProviderSnapshot,
  type RequisiteProviderSnapshot,
} from "../../domain/requisite-provider";
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

    return this.uow.run(async (tx) => {
      const created = await tx.requisiteProviderStore.create(
        createRequisiteProviderSnapshot({
          id: this.runtime.generateUuid(),
          now: this.runtime.now(),
          ...validated,
        }) satisfies RequisiteProviderSnapshot,
      );

      this.runtime.log.info("Requisite provider created", {
        id: created.id,
        name: created.name,
      });

      return created;
    });
  }
}
