import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { opsTodos } from "../../../infra/drizzle/schema/tasks";
import type {
  CreateTodoInput,
  ToggleTodoInput,
  UpdateTodoInput,
} from "../../application/contracts/commands";
import type { Todo } from "../../application/contracts/dto";
import type { TodoStore } from "../../application/ports/todo.store";

export class DrizzleTodoStore implements TodoStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Todo | null> {
    const [row] = await this.db
      .select()
      .from(opsTodos)
      .where(eq(opsTodos.id, id))
      .limit(1);
    return (row as Todo) ?? null;
  }

  async create(input: CreateTodoInput): Promise<Todo> {
    const [created] = await this.db
      .insert(opsTodos)
      .values({
        agentId: input.agentId,
        dealId: input.dealId ?? null,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        assignedBy: input.assignedBy ?? null,
        order: input.order ?? 0,
      })
      .returning();
    return created! as Todo;
  }

  async update(input: UpdateTodoInput): Promise<Todo | null> {
    const values: Record<string, unknown> = {};

    if (input.title !== undefined) values.title = input.title;
    if (input.description !== undefined) values.description = input.description;
    if (input.dueDate !== undefined) values.dueDate = input.dueDate;
    if (input.order !== undefined) values.order = input.order;

    const [updated] = await this.db
      .update(opsTodos)
      .set(values)
      .where(eq(opsTodos.id, input.id))
      .returning();
    return (updated as Todo) ?? null;
  }

  async toggle(input: ToggleTodoInput): Promise<Todo | null> {
    const [toggled] = await this.db
      .update(opsTodos)
      .set({ completed: input.completed })
      .where(eq(opsTodos.id, input.id))
      .returning();
    return (toggled as Todo) ?? null;
  }

  async remove(id: number): Promise<boolean> {
    const [deleted] = await this.db
      .delete(opsTodos)
      .where(eq(opsTodos.id, id))
      .returning({ id: opsTodos.id });
    return Boolean(deleted);
  }
}
