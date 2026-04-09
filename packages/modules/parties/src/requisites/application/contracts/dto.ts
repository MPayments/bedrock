import { z } from "zod";

import { RequisiteKindSchema } from "./zod";
import { LocaleTextMapSchema } from "../../../shared/domain/locale-map";
import {
  REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_VALUES,
  REQUISITE_PROVIDER_IDENTIFIER_SCHEME_VALUES,
} from "../../domain/identifier-schemes";

export const RequisiteProviderIdentifierSchemeSchema = z.enum(
  REQUISITE_PROVIDER_IDENTIFIER_SCHEME_VALUES,
);
export type RequisiteProviderIdentifierSchemeValue = z.infer<
  typeof RequisiteProviderIdentifierSchemeSchema
>;
export const RequisiteProviderBranchIdentifierSchemeSchema = z.enum(
  REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_VALUES,
);
export type RequisiteProviderBranchIdentifierSchemeValue = z.infer<
  typeof RequisiteProviderBranchIdentifierSchemeSchema
>;

export const RequisiteProviderIdentifierSchema = z.object({
  id: z.uuid(),
  scheme: RequisiteProviderIdentifierSchemeSchema,
  value: z.string(),
  normalizedValue: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const RequisiteProviderBranchIdentifierSchema = z.object({
  id: z.uuid(),
  scheme: RequisiteProviderBranchIdentifierSchemeSchema,
  value: z.string(),
  normalizedValue: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const RequisiteProviderBranchSchema = z.object({
  id: z.uuid(),
  providerId: z.uuid(),
  code: z.string().nullable(),
  name: z.string(),
  nameI18n: LocaleTextMapSchema,
  country: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  cityI18n: LocaleTextMapSchema,
  line1: z.string().nullable(),
  line1I18n: LocaleTextMapSchema,
  line2: z.string().nullable(),
  line2I18n: LocaleTextMapSchema,
  rawAddress: z.string().nullable(),
  rawAddressI18n: LocaleTextMapSchema,
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  isPrimary: z.boolean(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  identifiers: z.array(RequisiteProviderBranchIdentifierSchema),
});

export const RequisiteProviderListItemSchema = z.object({
  id: z.uuid(),
  kind: RequisiteKindSchema,
  legalName: z.string(),
  legalNameI18n: LocaleTextMapSchema,
  displayName: z.string(),
  displayNameI18n: LocaleTextMapSchema,
  description: z.string().nullable(),
  country: z.string().nullable(),
  website: z.string().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const RequisiteProviderSchema = RequisiteProviderListItemSchema.extend({
  identifiers: z.array(RequisiteProviderIdentifierSchema),
  branches: z.array(RequisiteProviderBranchSchema),
});

export type RequisiteProviderListItem = z.infer<
  typeof RequisiteProviderListItemSchema
>;
export type RequisiteProvider = z.infer<typeof RequisiteProviderSchema>;

export const RequisiteProviderOptionSchema = z.object({
  id: z.uuid(),
  kind: RequisiteKindSchema,
  displayName: z.string(),
  label: z.string(),
});

export const RequisiteProviderOptionsResponseSchema = z.object({
  data: z.array(RequisiteProviderOptionSchema),
});

export type RequisiteProviderOption = z.infer<
  typeof RequisiteProviderOptionSchema
>;
