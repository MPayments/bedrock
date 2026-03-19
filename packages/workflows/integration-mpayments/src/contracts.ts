import { z } from "zod";

export const IntegrationPayloadSchema = z.object({
  entity: z.string().min(1),
  action: z.string().min(1),
  entityId: z.coerce.number().int().positive(),
  data: z.record(z.string(), z.unknown()),
  metadata: z.object({
    userId: z.coerce.number().int().positive().optional(),
    source: z.string().optional(),
    timestamp: z.iso.datetime(),
  }),
});

export type IntegrationPayload = z.infer<typeof IntegrationPayloadSchema>;

export const CustomerCreatedDataSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  email: z.email(),
});

export type CustomerCreatedData = z.infer<typeof CustomerCreatedDataSchema>;

export const ClientCreatedDataSchema = z.object({
  id: z.number(),
  orgName: z.string().min(1),
  orgType: z.string().optional(),
  directorName: z.string().optional(),
  position: z.string().optional(),
  directorBasis: z.string().optional(),
  address: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  inn: z.string().optional(),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  oktmo: z.string().optional(),
  okpo: z.string().optional(),
  bankName: z.string().optional(),
  bankCountry: z.string().optional(),
  bankAddress: z.string().optional(),
  account: z.string().optional(),
  bic: z.string().optional(),
  corrAccount: z.string().optional(),
});

export type ClientCreatedData = z.infer<typeof ClientCreatedDataSchema>;
