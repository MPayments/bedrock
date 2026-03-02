import { z } from "zod";

export {
  AccountProviderTypeSchema,
  CounterpartyAccountProviderSchema,
  CounterpartyAccountSchema,
  CountryAlpha2Schema,
  CreateProviderInputSchema,
  UpdateProviderInputSchema,
  COUNTERPARTY_ACCOUNT_PROVIDERS_LIST_CONTRACT,
  ListProvidersQuerySchema,
  CreateAccountInputSchema,
  UpdateAccountInputSchema,
  COUNTERPARTY_ACCOUNTS_LIST_CONTRACT,
  ListAccountsQuerySchema,
  ResolveCounterpartyAccountBindingsInputSchema,
  CounterpartyAccountBindingSchema,
} from "./validation";

export type {
  AccountProviderType,
  CreateProviderInput,
  UpdateProviderInput,
  ListProvidersQuery,
  CreateAccountInput,
  UpdateAccountInput,
  ListAccountsQuery,
  ResolveCounterpartyAccountBindingsInput,
  CounterpartyAccountBinding,
} from "./validation";

export const CounterpartyAccountProviderOptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.string(),
  country: z.string(),
  label: z.string(),
});

export const CounterpartyAccountProviderOptionsResponseSchema = z.object({
  data: z.array(CounterpartyAccountProviderOptionSchema),
});

export type CounterpartyAccountProviderOption = z.infer<
  typeof CounterpartyAccountProviderOptionSchema
>;
