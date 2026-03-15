import { z } from "zod";

export const CounterpartyGroupSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parentId: z.uuid().nullable(),
  customerId: z.uuid().nullable(),
  customerLabel: z.string().nullable().optional(),
  isSystem: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CounterpartyGroup = z.infer<typeof CounterpartyGroupSchema>;

export const ListCounterpartyGroupsQuerySchema = z.object({
  parentId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  includeSystem: z.coerce.boolean().optional(),
});

export type ListCounterpartyGroupsQuery = z.infer<
  typeof ListCounterpartyGroupsQuerySchema
>;

export const CreateCounterpartyGroupInputSchema = z.object({
  code: z.string().min(1, "code is required"),
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  parentId: z.uuid().optional(),
  customerId: z.uuid().optional(),
});

export type CreateCounterpartyGroupInput = z.infer<
  typeof CreateCounterpartyGroupInputSchema
>;

export const UpdateCounterpartyGroupInputSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  customerId: z.uuid().nullable().optional(),
});

export type UpdateCounterpartyGroupInput = z.infer<
  typeof UpdateCounterpartyGroupInputSchema
>;

export const CounterpartyGroupOptionSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  parentId: z.uuid().nullable(),
  customerId: z.uuid().nullable(),
  customerLabel: z.string().nullable().optional(),
  isSystem: z.boolean(),
  label: z.string(),
});

export const CounterpartyGroupOptionsResponseSchema = z.object({
  data: z.array(CounterpartyGroupOptionSchema),
});

export type CounterpartyGroupOption = z.infer<
  typeof CounterpartyGroupOptionSchema
>;
