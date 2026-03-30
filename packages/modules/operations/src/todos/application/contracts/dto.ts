import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

export const TodoSchema = z.object({
  id: z.number().int(),
  agentId: z.string(),
  dealId: z.string().uuid().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  completed: z.boolean(),
  order: z.number().int(),
  dueDate: z.string().nullable().optional(),
  assignedBy: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Todo = z.infer<typeof TodoSchema>;

export const PaginatedTodosSchema = createPaginatedListSchema(TodoSchema);

export type PaginatedTodos = z.infer<typeof PaginatedTodosSchema>;
