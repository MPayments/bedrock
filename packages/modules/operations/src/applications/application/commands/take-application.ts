import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  ApplicationNotFoundError,
  OperationsError,
} from "../../../errors";
import {
  TakeApplicationInputSchema,
  type TakeApplicationInput,
} from "../contracts/commands";
import type { ApplicationsCommandUnitOfWork } from "../ports/applications.uow";

export class ApplicationAlreadyAssignedError extends OperationsError {
  constructor(id: number, existingAgentId: string) {
    super(
      `Application ${id} is already assigned to agent ${existingAgentId}`,
    );
  }
}

export class TakeApplicationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ApplicationsCommandUnitOfWork,
  ) {}

  async execute(input: TakeApplicationInput) {
    const validated = TakeApplicationInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const application = await tx.applicationStore.findById(
        validated.applicationId,
      );
      if (!application) {
        throw new ApplicationNotFoundError(validated.applicationId);
      }

      if (application.agentId !== null) {
        throw new ApplicationAlreadyAssignedError(
          validated.applicationId,
          application.agentId,
        );
      }

      const updated = await tx.applicationStore.assignAgent(
        validated.applicationId,
        validated.agentId,
      );

      // Auto-create TODO for the agent
      await tx.todoStore.create({
        agentId: validated.agentId,
        applicationId: validated.applicationId,
        title: `Создать расчёт для заявки #${validated.applicationId}`,
        description: application.requestedAmount
          ? `Сумма: ${application.requestedAmount} ${application.requestedCurrency ?? ""}`
          : "Клиент ожидает расчёт",
        order: 0,
      });

      this.runtime.log.info("Application taken by agent", {
        applicationId: validated.applicationId,
        agentId: validated.agentId,
      });

      return updated;
    });
  }
}
