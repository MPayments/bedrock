import type { ModuleRuntime } from "@bedrock/shared/core";

import { TodoNotFoundError } from "../../../errors";
import {
  UpdateTodoInputSchema,
  type UpdateTodoInput,
} from "../contracts/commands";
import type { TodosCommandUnitOfWork } from "../ports/todos.uow";

export class UpdateTodoCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: TodosCommandUnitOfWork,
  ) {}

  async execute(input: UpdateTodoInput) {
    const validated = UpdateTodoInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const updated = await tx.todoStore.update(validated);
      if (!updated) {
        throw new TodoNotFoundError(validated.id);
      }

      this.runtime.log.info("Todo updated", { id: validated.id });

      return updated;
    });
  }
}
