import type { ModuleRuntime } from "@bedrock/shared/core";

import { RequisiteProviderNotFoundError } from "../errors";
import type { RequisitesCommandUnitOfWork } from "../ports/requisites.uow";

export class RemoveRequisiteProviderCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: RequisitesCommandUnitOfWork,
  ) {}

  async execute(id: string) {
    await this.uow.run(async (tx) => {
      const archived = await tx.requisiteProviderStore.archive(
        id,
        this.runtime.now(),
      );
      if (!archived) {
        throw new RequisiteProviderNotFoundError(id);
      }
    });

    this.runtime.log.info("Requisite provider archived", { id });
  }
}
