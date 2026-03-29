import type { ModuleRuntime } from "@bedrock/shared/core";

import type { ApplicationStatus } from "../../domain/application-status";
import {
  CreateApplicationInputSchema,
  type CreateApplicationInput,
} from "../contracts/commands";
import type { ApplicationsCommandUnitOfWork } from "../ports/applications.uow";

export class CreateApplicationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ApplicationsCommandUnitOfWork,
  ) {}

  async execute(input: CreateApplicationInput) {
    const validated = CreateApplicationInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      // Agent creates with status 'created', customer creates with 'forming'
      const status: ApplicationStatus = validated.agentId
        ? "created"
        : "forming";
      const client =
        await tx.clientStore.findActiveByCounterpartyId(validated.counterpartyId);

      if (!client) {
        throw new Error(
          `Active client shell not found for counterparty ${validated.counterpartyId}`,
        );
      }

      const created = await tx.applicationStore.create({
        agentId: validated.agentId ?? null,
        clientId: client.id,
        counterpartyId: validated.counterpartyId,
        status,
        requestedAmount: validated.requestedAmount,
        requestedCurrency: validated.requestedCurrency,
      });

      this.runtime.log.info("Application created", {
        id: created.id,
        clientId: created.clientId,
        counterpartyId: created.counterpartyId,
        status,
      });

      return created;
    });
  }
}
