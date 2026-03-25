import { TodoNotFoundError } from "../../../errors";
import type { TodoReads } from "../ports/todo.reads";

export class FindTodoByIdQuery {
  constructor(private readonly reads: TodoReads) {}

  async execute(id: number) {
    const todo = await this.reads.findById(id);
    if (!todo) {
      throw new TodoNotFoundError(id);
    }
    return todo;
  }
}
