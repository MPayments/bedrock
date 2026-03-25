import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Todo } from "../contracts/dto";
import type { ListTodosQuery } from "../contracts/queries";

export interface TodoReads {
  findById(id: number): Promise<Todo | null>;
  list(input: ListTodosQuery): Promise<PaginatedList<Todo>>;
}
