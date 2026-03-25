import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  CreateTodoInputSchema,
  type CreateTodoInput,
} from "../contracts/commands";
import type { TodosCommandUnitOfWork } from "../ports/todos.uow";

export class CreateTodoCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: TodosCommandUnitOfWork,
  ) {}

  async execute(input: CreateTodoInput) {
    const validated = CreateTodoInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const created = await tx.todoStore.create(validated);

      this.runtime.log.info("Todo created", {
        id: created.id,
        agentId: created.agentId,
        title: created.title,
      });

      return created;
    });
  }
}
