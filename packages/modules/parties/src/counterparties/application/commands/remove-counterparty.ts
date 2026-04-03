import type { ModuleRuntime } from "@bedrock/shared/core";

import { CounterpartyNotFoundError } from "../errors";
import type { CounterpartiesCommandUnitOfWork } from "../ports/counterparties.uow";

export class RemoveCounterpartyCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: CounterpartiesCommandUnitOfWork,
  ) {}

  async execute(id: string) {
    await this.uow.run(async (tx) => {
      const deleted = await tx.counterparties.remove(id);
      if (!deleted) {
        throw new CounterpartyNotFoundError(id);
      }
    });

    this.runtime.log.info("Counterparty deleted", { id });
  }
}
