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

export type CounterpartyGroup = z.output<typeof CounterpartyGroupSchema>;

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

export type CounterpartyGroupOption = z.output<
  typeof CounterpartyGroupOptionSchema
>;
