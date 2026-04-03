import { z } from "zod";

import {
  createPaginatedListSchema,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  PartyKindSchema,
  type PartyKind,
} from "../../domain/party-kind";

export const OrganizationLocalizedTextSchema = z
  .object({
    ru: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const OrganizationSchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  shortName: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  kind: PartyKindSchema,
  isActive: z.boolean(),
  nameI18n: OrganizationLocalizedTextSchema,
  orgType: z.string().nullable(),
  orgTypeI18n: OrganizationLocalizedTextSchema,
  countryI18n: OrganizationLocalizedTextSchema,
  city: z.string().nullable(),
  cityI18n: OrganizationLocalizedTextSchema,
  address: z.string().nullable(),
  addressI18n: OrganizationLocalizedTextSchema,
  inn: z.string().nullable(),
  taxId: z.string().nullable(),
  kpp: z.string().nullable(),
  ogrn: z.string().nullable(),
  oktmo: z.string().nullable(),
  okpo: z.string().nullable(),
  directorName: z.string().nullable(),
  directorNameI18n: OrganizationLocalizedTextSchema,
  directorPosition: z.string().nullable(),
  directorPositionI18n: OrganizationLocalizedTextSchema,
  directorBasis: z.string().nullable(),
  directorBasisI18n: OrganizationLocalizedTextSchema,
  signatureKey: z.string().nullable(),
  sealKey: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Organization = z.output<typeof OrganizationSchema>;
export type OrganizationKind = PartyKind;

export const PaginatedOrganizationsSchema =
  createPaginatedListSchema(OrganizationSchema);

export type PaginatedOrganizations = PaginatedList<Organization>;

export const OrganizationOptionSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  label: z.string(),
});

export const OrganizationOptionsResponseSchema = z.object({
  data: z.array(OrganizationOptionSchema),
});

export type OrganizationOption = z.infer<typeof OrganizationOptionSchema>;
