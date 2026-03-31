import { z } from "zod";

import {
  CountryCodeSchema,
  PartyKindSchema,
} from "../../../shared/domain/party-kind";
import { CounterpartyRelationshipKindSchema } from "../../domain/relationship-kind";

const LocalizedTextSchema = z
  .object({
    en: z.string().trim().nullable().optional(),
    ru: z.string().trim().nullable().optional(),
  })
  .nullable();

function trimToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const CreateCounterpartyInputSchema = z.object({
  shortName: z.string().trim().min(1, "shortName is required"),
  fullName: z.string().trim().min(1, "fullName is required"),
  kind: PartyKindSchema.default("legal_entity"),
  relationshipKind: CounterpartyRelationshipKindSchema.default("external"),
  country: CountryCodeSchema.nullish().transform((value) => value ?? null),
  orgNameI18n: LocalizedTextSchema.optional().default(null),
  orgType: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  orgTypeI18n: LocalizedTextSchema.optional().default(null),
  directorName: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  directorNameI18n: LocalizedTextSchema.optional().default(null),
  position: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  positionI18n: LocalizedTextSchema.optional().default(null),
  directorBasis: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  directorBasisI18n: LocalizedTextSchema.optional().default(null),
  address: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  addressI18n: LocalizedTextSchema.optional().default(null),
  email: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  phone: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  inn: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  kpp: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  ogrn: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  oktmo: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  okpo: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  externalId: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  description: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  customerId: z
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
  groupIds: z.array(z.uuid()).default([]),
});

export type CreateCounterpartyInput = z.input<
  typeof CreateCounterpartyInputSchema
>;

export const UpdateCounterpartyInputSchema = z.object({
  shortName: z.string().trim().min(1).exactOptional(),
  fullName: z.string().trim().min(1).exactOptional(),
  kind: PartyKindSchema.exactOptional(),
  relationshipKind: CounterpartyRelationshipKindSchema.exactOptional(),
  country: CountryCodeSchema.nullable().exactOptional(),
  orgNameI18n: LocalizedTextSchema.exactOptional(),
  orgType: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  orgTypeI18n: LocalizedTextSchema.exactOptional(),
  directorName: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  directorNameI18n: LocalizedTextSchema.exactOptional(),
  position: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  positionI18n: LocalizedTextSchema.exactOptional(),
  directorBasis: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  directorBasisI18n: LocalizedTextSchema.exactOptional(),
  address: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  addressI18n: LocalizedTextSchema.exactOptional(),
  email: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  phone: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  inn: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  kpp: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  ogrn: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  oktmo: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  okpo: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  externalId: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  description: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  customerId: z.uuid().nullable().exactOptional(),
  groupIds: z.array(z.uuid()).exactOptional(),
});

export type UpdateCounterpartyInput = z.input<
  typeof UpdateCounterpartyInputSchema
>;
