import { z } from "zod";

export const CreateTodoInputSchema = z.object({
  agentId: z.number().int(),
  applicationId: z.number().int().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  assignedBy: z.number().int().nullable().optional(),
  order: z.number().int().default(0),
});

export type CreateTodoInput = z.infer<typeof CreateTodoInputSchema>;

export const UpdateTodoInputSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  order: z.number().int().optional(),
});

export type UpdateTodoInput = z.infer<typeof UpdateTodoInputSchema>;

export const ToggleTodoInputSchema = z.object({
  id: z.number().int(),
  completed: z.boolean(),
});

export type ToggleTodoInput = z.infer<typeof ToggleTodoInputSchema>;
