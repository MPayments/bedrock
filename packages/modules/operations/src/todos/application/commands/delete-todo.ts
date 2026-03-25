import type { ModuleRuntime } from "@bedrock/shared/core";

import { TodoNotFoundError } from "../../../errors";
import type { TodosCommandUnitOfWork } from "../ports/todos.uow";

export class DeleteTodoCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: TodosCommandUnitOfWork,
  ) {}

  async execute(id: number) {
    return this.unitOfWork.run(async (tx) => {
      const deleted = await tx.todoStore.remove(id);
      if (!deleted) {
        throw new TodoNotFoundError(id);
      }

      this.runtime.log.info("Todo deleted", { id });

      return deleted;
    });
  }
}
