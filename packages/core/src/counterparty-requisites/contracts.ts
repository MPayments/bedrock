import { z } from "zod";

export {
  CounterpartyRequisiteSchema,
  COUNTERPARTY_REQUISITES_LIST_CONTRACT,
  ListCounterpartyRequisitesQuerySchema,
  CreateCounterpartyRequisiteInputSchema,
  UpdateCounterpartyRequisiteInputSchema,
  ListCounterpartyRequisiteOptionsQuerySchema,
} from "./validation";

export type {
  CounterpartyRequisite,
  ListCounterpartyRequisitesQuery,
  CreateCounterpartyRequisiteInput,
  UpdateCounterpartyRequisiteInput,
  ListCounterpartyRequisiteOptionsQuery,
} from "./validation";

export const CounterpartyRequisiteOptionSchema = z.object({
  id: z.uuid(),
  counterpartyId: z.uuid(),
  currencyId: z.uuid(),
  kind: z.string(),
  label: z.string(),
});

export const CounterpartyRequisiteOptionsResponseSchema = z.object({
  data: z.array(CounterpartyRequisiteOptionSchema),
});

export type CounterpartyRequisiteOption = z.infer<
  typeof CounterpartyRequisiteOptionSchema
>;
