import type { ModuleRuntime } from "@bedrock/shared/core";

import { AgreementNotFoundError } from "../../errors";
import type { AgreementsCommandUnitOfWork } from "../ports/agreements.uow";

export class ArchiveAgreementCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: AgreementsCommandUnitOfWork,
  ) {}

  async execute(id: string) {
    return this.commandUow.run(async (tx) => {
      const current = await tx.agreementReads.findById(id);

      if (!current) {
        throw new AgreementNotFoundError(id);
      }

      await tx.agreementStore.setActive({
        agreementId: id,
        isActive: false,
      });

      this.runtime.log.info("Agreement archived", { agreementId: id });

      return true;
    });
  }
}
