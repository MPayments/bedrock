import { z } from "zod";

const nullableDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const nullableUuidSchema = z.string().uuid().nullable();

export const CrmTaskUserSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const CrmTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  dueDate: nullableDateStringSchema,
  completed: z.boolean(),
  sortOrder: z.number().int(),
  assigneeUserId: z.string(),
  assignedByUserId: z.string(),
  dealId: nullableUuidSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  assigneeUser: CrmTaskUserSummarySchema.nullable(),
  assignedByUser: CrmTaskUserSummarySchema.nullable(),
});

export type CrmTask = z.infer<typeof CrmTaskSchema>;

export const ListCrmTasksQuerySchema = z.object({
  assigneeUserId: z.string().optional(),
  completed: z.boolean().optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  includeNoDueDate: z.boolean().optional(),
  dealId: z.string().uuid().optional(),
});

export type ListCrmTasksQuery = z.infer<typeof ListCrmTasksQuerySchema>;

export const ListCrmTasksResponseSchema = z.object({
  data: z.array(CrmTaskSchema),
});

export type ListCrmTasksResponse = z.infer<typeof ListCrmTasksResponseSchema>;

export const CreateCrmTaskInputSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  dueDate: nullableDateStringSchema.optional(),
  assigneeUserId: z.string().optional(),
  dealId: nullableUuidSchema.optional(),
});

export type CreateCrmTaskInput = z.infer<typeof CreateCrmTaskInputSchema>;

export const UpdateCrmTaskInputSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
    dueDate: nullableDateStringSchema.optional(),
    completed: z.boolean().optional(),
    assigneeUserId: z.string().optional(),
    dealId: nullableUuidSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be updated",
  });

export type UpdateCrmTaskInput = z.infer<typeof UpdateCrmTaskInputSchema>;

export const DeleteCrmTaskResponseSchema = z.object({
  deleted: z.literal(true),
});

export const ReorderCrmTasksInputSchema = z.object({
  orderedTaskIds: z.array(z.string().uuid()).min(1),
});

export type ReorderCrmTasksInput = z.infer<typeof ReorderCrmTasksInputSchema>;

export const ReorderCrmTasksResponseSchema = z.object({
  success: z.literal(true),
});

export const CalendarCrmTasksQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  assigneeUserId: z.string().optional(),
});

export type CalendarCrmTasksQuery = z.infer<typeof CalendarCrmTasksQuerySchema>;

export const CalendarCrmTasksResponseSchema = z.object({
  month: z.string(),
  tasks: z.record(z.string(), z.array(CrmTaskSchema)),
  totalCount: z.number().int(),
});

export type CalendarCrmTasksResponse = z.infer<
  typeof CalendarCrmTasksResponseSchema
>;

export const CrmTaskCapabilitiesSchema = z.object({
  currentUserId: z.string(),
  canAssignOthers: z.boolean(),
});

export type CrmTaskCapabilities = z.infer<typeof CrmTaskCapabilitiesSchema>;
