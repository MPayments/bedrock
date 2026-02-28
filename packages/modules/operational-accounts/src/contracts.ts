import { z } from "zod";

export {
  AccountProviderTypeSchema,
  AccountProviderSchema,
  AccountSchema,
  CountryAlpha2Schema,
  CreateProviderInputSchema,
  UpdateProviderInputSchema,
  PROVIDERS_LIST_CONTRACT,
  ListProvidersQuerySchema,
  CreateAccountInputSchema,
  UpdateAccountInputSchema,
  ACCOUNTS_LIST_CONTRACT,
  ListAccountsQuerySchema,
  ResolveTransferBindingsInputSchema,
  TransferAccountBindingSchema,
} from "./validation";

export type {
  AccountProviderType,
  CreateProviderInput,
  UpdateProviderInput,
  ListProvidersQuery,
  CreateAccountInput,
  UpdateAccountInput,
  ListAccountsQuery,
  ResolveTransferBindingsInput,
  TransferAccountBinding,
} from "./validation";

export const AccountProviderOptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.string(),
  country: z.string(),
  label: z.string(),
});

export const AccountProviderOptionsResponseSchema = z.object({
  data: z.array(AccountProviderOptionSchema),
});

export type AccountProviderOption = z.infer<typeof AccountProviderOptionSchema>;
