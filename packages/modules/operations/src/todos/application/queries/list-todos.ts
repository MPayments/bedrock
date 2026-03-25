import { ListTodosQuerySchema } from "../contracts/queries";
import type { TodoReads } from "../ports/todo.reads";

export class ListTodosQuery {
  constructor(private readonly reads: TodoReads) {}

  async execute(input?: unknown) {
    const query = ListTodosQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}
