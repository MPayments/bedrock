import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { opsTodos } from "../../../infra/drizzle/schema/tasks";
import type { Todo } from "../../application/contracts/dto";
import type { ListTodosQuery } from "../../application/contracts/queries";
import type { TodoReads } from "../../application/ports/todo.reads";

const TODO_SORT_COLUMN_MAP = {
  title: opsTodos.title,
  createdAt: opsTodos.createdAt,
  order: opsTodos.order,
} as const;

export class DrizzleTodoReads implements TodoReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Todo | null> {
    const [row] = await this.db
      .select()
      .from(opsTodos)
      .where(eq(opsTodos.id, id))
      .limit(1);
    return (row as Todo) ?? null;
  }

  async list(input: ListTodosQuery): Promise<PaginatedList<Todo>> {
    const conditions: SQL[] = [];

    if (input.agentId) {
      conditions.push(eq(opsTodos.agentId, input.agentId));
    }
    if (input.completed !== undefined) {
      conditions.push(eq(opsTodos.completed, input.completed));
    }
    if (input.applicationId) {
      conditions.push(
        eq(opsTodos.applicationId, input.applicationId),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      TODO_SORT_COLUMN_MAP,
      opsTodos.order,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(opsTodos)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsTodos)
        .where(where),
    ]);

    return {
      data: rows as Todo[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }
}
