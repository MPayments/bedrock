import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import { PartyKindSchema } from "../../domain/party-kind";
import { OrganizationLocalizedTextSchema } from "./dto";

export const CreateOrganizationInputSchema = z.object({
  shortName: z.string().trim().min(1, "shortName is required"),
  fullName: z.string().trim().min(1, "fullName is required"),
  kind: PartyKindSchema.default("legal_entity"),
  country: z
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
  isActive: z.boolean().default(true),
  nameI18n: OrganizationLocalizedTextSchema,
  orgType: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  orgTypeI18n: OrganizationLocalizedTextSchema,
  countryI18n: OrganizationLocalizedTextSchema,
  city: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  cityI18n: OrganizationLocalizedTextSchema,
  address: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  addressI18n: OrganizationLocalizedTextSchema,
  inn: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  taxId: z
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
  directorName: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  directorNameI18n: OrganizationLocalizedTextSchema,
  directorPosition: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  directorPositionI18n: OrganizationLocalizedTextSchema,
  directorBasis: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  directorBasisI18n: OrganizationLocalizedTextSchema,
  signatureKey: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  sealKey: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
});

export type CreateOrganizationInput = z.input<
  typeof CreateOrganizationInputSchema
>;

export const UpdateOrganizationInputSchema = z.object({
  shortName: z.string().trim().min(1).exactOptional(),
  fullName: z.string().trim().min(1).exactOptional(),
  kind: PartyKindSchema.exactOptional(),
  country: z
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
  isActive: z.boolean().exactOptional(),
  nameI18n: OrganizationLocalizedTextSchema.exactOptional(),
  orgType: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  orgTypeI18n: OrganizationLocalizedTextSchema.exactOptional(),
  countryI18n: OrganizationLocalizedTextSchema.exactOptional(),
  city: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  cityI18n: OrganizationLocalizedTextSchema.exactOptional(),
  address: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  addressI18n: OrganizationLocalizedTextSchema.exactOptional(),
  inn: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  taxId: z
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
  directorName: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  directorNameI18n: OrganizationLocalizedTextSchema.exactOptional(),
  directorPosition: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  directorPositionI18n: OrganizationLocalizedTextSchema.exactOptional(),
  directorBasis: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  directorBasisI18n: OrganizationLocalizedTextSchema.exactOptional(),
  signatureKey: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  sealKey: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
});

export type UpdateOrganizationInput = z.input<
  typeof UpdateOrganizationInputSchema
>;
