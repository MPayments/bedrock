import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

export const TODOS_LIST_CONTRACT = {
  sortableColumns: ["title", "createdAt", "order"] as const,
  defaultSort: { id: "order" as const, desc: false },
  filters: {
    agentId: { kind: "string" as const, cardinality: "single" as const },
    completed: { kind: "boolean" as const, cardinality: "single" as const },
    applicationId: { kind: "number" as const, cardinality: "single" as const },
  },
} satisfies ListQueryContract<
  readonly ["title", "createdAt", "order"],
  any
>;

export const ListTodosQuerySchema =
  createListQuerySchemaFromContract(TODOS_LIST_CONTRACT);

export type ListTodosQuery = z.infer<typeof ListTodosQuerySchema>;
