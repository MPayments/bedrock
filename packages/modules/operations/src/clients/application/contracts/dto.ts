import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

const LocalizedTextSchema = z
  .object({
    ru: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
  })
  .nullable();

export const ClientSchema = z.object({
  id: z.number().int(),
  orgName: z.string(),
  orgNameI18n: LocalizedTextSchema,
  orgType: z.string().nullable(),
  orgTypeI18n: LocalizedTextSchema,
  directorName: z.string().nullable(),
  directorNameI18n: LocalizedTextSchema,
  position: z.string().nullable(),
  positionI18n: LocalizedTextSchema,
  directorBasis: z.string().nullable(),
  directorBasisI18n: LocalizedTextSchema,
  address: z.string().nullable(),
  addressI18n: LocalizedTextSchema,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  inn: z.string().nullable(),
  kpp: z.string().nullable(),
  ogrn: z.string().nullable(),
  oktmo: z.string().nullable(),
  okpo: z.string().nullable(),
  bankName: z.string().nullable(),
  bankNameI18n: LocalizedTextSchema,
  bankAddress: z.string().nullable(),
  bankAddressI18n: LocalizedTextSchema,
  account: z.string().nullable(),
  bic: z.string().nullable(),
  corrAccount: z.string().nullable(),
  bankCountry: z.string().nullable(),
  isDeleted: z.boolean(),
  subAgentCounterpartyId: z.string().uuid().nullable(),
  userId: z.string().nullable(),
  counterpartyId: z.string().nullable(),
  customerId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Client = z.infer<typeof ClientSchema>;

export const PaginatedClientsSchema =
  createPaginatedListSchema(ClientSchema);

export type PaginatedClients = z.infer<typeof PaginatedClientsSchema>;
