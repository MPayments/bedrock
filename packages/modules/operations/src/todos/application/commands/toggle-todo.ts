import type { ModuleRuntime } from "@bedrock/shared/core";

import { TodoNotFoundError } from "../../../errors";
import {
  ToggleTodoInputSchema,
  type ToggleTodoInput,
} from "../contracts/commands";
import type { TodosCommandUnitOfWork } from "../ports/todos.uow";

export class ToggleTodoCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: TodosCommandUnitOfWork,
  ) {}

  async execute(input: ToggleTodoInput) {
    const validated = ToggleTodoInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const toggled = await tx.todoStore.toggle(validated);
      if (!toggled) {
        throw new TodoNotFoundError(validated.id);
      }

      this.runtime.log.info("Todo toggled", {
        id: validated.id,
        completed: validated.completed,
      });

      return toggled;
    });
  }
}
