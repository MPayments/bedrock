import { z } from "zod";

export {
  CounterpartyKindSchema,
  CountryCodeSchema,
  CounterpartySchema,
  COUNTERPARTIES_LIST_CONTRACT,
  ListCounterpartiesQuerySchema,
  CreateCounterpartyInputSchema,
  UpdateCounterpartyInputSchema,
  CounterpartyGroupSchema,
  ListCounterpartyGroupsQuerySchema,
  CreateCounterpartyGroupInputSchema,
  UpdateCounterpartyGroupInputSchema,
} from "./validation";

export type {
  CounterpartyKind,
  Counterparty,
  ListCounterpartiesQuery,
  CreateCounterpartyInput,
  UpdateCounterpartyInput,
  CounterpartyGroup,
  ListCounterpartyGroupsQuery,
  CreateCounterpartyGroupInput,
  UpdateCounterpartyGroupInput,
} from "./validation";

export const CounterpartyOptionSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  label: z.string(),
});

export const CounterpartyOptionsResponseSchema = z.object({
  data: z.array(CounterpartyOptionSchema),
});

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

export type CounterpartyOption = z.infer<typeof CounterpartyOptionSchema>;
export type CounterpartyGroupOption = z.infer<
  typeof CounterpartyGroupOptionSchema
>;
