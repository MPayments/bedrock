import type { ModuleRuntime } from "@bedrock/shared/core";

import { ClientNotFoundError } from "../../../errors";
import {
  UpdateClientInputSchema,
  type UpdateClientInput,
} from "../contracts/commands";
import type { ClientsCommandUnitOfWork } from "../ports/clients.uow";

export class UpdateClientCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ClientsCommandUnitOfWork,
  ) {}

  async execute(input: UpdateClientInput) {
    const validated = UpdateClientInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.clientStore.findById(validated.id);
      if (!existing) {
        throw new ClientNotFoundError(validated.id);
      }

      const updated = await tx.clientStore.update(validated);

      this.runtime.log.info("Client updated", { id: validated.id });

      return updated;
    });
  }
}
