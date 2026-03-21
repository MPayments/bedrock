import { z } from "zod";

export const ListCounterpartyGroupsQuerySchema = z.object({
  parentId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  includeSystem: z.coerce.boolean().optional(),
});

export type ListCounterpartyGroupsQuery = z.infer<
  typeof ListCounterpartyGroupsQuerySchema
>;
