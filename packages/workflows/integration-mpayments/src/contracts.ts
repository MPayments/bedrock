import { z } from "zod";

function normalizeOptionalExternalString(value: unknown) {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const OptionalExternalStringSchema = z.preprocess(
  normalizeOptionalExternalString,
  z.string().optional(),
);

const OptionalExternalEmailSchema = z.preprocess(
  normalizeOptionalExternalString,
  z.email().optional(),
);

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
  email: OptionalExternalEmailSchema,
});

export type CustomerCreatedData = z.infer<typeof CustomerCreatedDataSchema>;

export const ClientCreatedDataSchema = z.object({
  id: z.number(),
  orgName: z.string().min(1),
  orgType: OptionalExternalStringSchema,
  directorName: OptionalExternalStringSchema,
  position: OptionalExternalStringSchema,
  directorBasis: OptionalExternalStringSchema,
  address: OptionalExternalStringSchema,
  email: OptionalExternalEmailSchema,
  phone: OptionalExternalStringSchema,
  inn: OptionalExternalStringSchema,
  kpp: OptionalExternalStringSchema,
  ogrn: OptionalExternalStringSchema,
  oktmo: OptionalExternalStringSchema,
  okpo: OptionalExternalStringSchema,
  bankName: OptionalExternalStringSchema,
  bankCountry: OptionalExternalStringSchema,
  bankAddress: OptionalExternalStringSchema,
  account: OptionalExternalStringSchema,
  bic: OptionalExternalStringSchema,
  corrAccount: OptionalExternalStringSchema,
});

export type ClientCreatedData = z.infer<typeof ClientCreatedDataSchema>;
