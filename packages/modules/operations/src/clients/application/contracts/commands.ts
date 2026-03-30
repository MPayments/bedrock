import { z } from "zod";

const LocalizedTextSchema = z
  .object({
    ru: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const CreateClientInputSchema = z.object({
  orgName: z.string().min(1),
  orgNameI18n: LocalizedTextSchema,
  orgType: z.string().nullable().optional(),
  orgTypeI18n: LocalizedTextSchema,
  directorName: z.string().nullable().optional(),
  directorNameI18n: LocalizedTextSchema,
  position: z.string().nullable().optional(),
  positionI18n: LocalizedTextSchema,
  directorBasis: z.string().nullable().optional(),
  directorBasisI18n: LocalizedTextSchema,
  address: z.string().nullable().optional(),
  addressI18n: LocalizedTextSchema,
  email: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().email().nullable().optional(),
  ),
  phone: z.string().nullable().optional(),
  inn: z.string().nullable().optional(),
  kpp: z.string().nullable().optional(),
  ogrn: z.string().nullable().optional(),
  oktmo: z.string().nullable().optional(),
  okpo: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankNameI18n: LocalizedTextSchema,
  bankAddress: z.string().nullable().optional(),
  bankAddressI18n: LocalizedTextSchema,
  account: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  corrAccount: z.string().nullable().optional(),
  bankCountry: z.string().nullable().optional(),
  subAgentCounterpartyId: z.string().uuid().nullable().optional(),
  // FK bridge to bedrock parties (auto-set by CounterpartiesPort)
  counterpartyId: z.string().uuid().nullable().optional(),
  // FK bridge to canonical Bedrock customers (auto-set by CustomerBridgePort)
  customerId: z.string().uuid().nullable().optional(),
});

export type CreateClientInput = z.infer<typeof CreateClientInputSchema>;

export const UpdateClientInputSchema = CreateClientInputSchema.partial().extend(
  {
    id: z.number().int(),
  },
);

export type UpdateClientInput = z.infer<typeof UpdateClientInputSchema>;
