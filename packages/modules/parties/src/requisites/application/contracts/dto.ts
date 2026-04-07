import { z } from "zod";

import { RequisiteKindSchema } from "./zod";

export const RequisiteProviderIdentifierSchema = z.object({
  id: z.uuid(),
  scheme: z.string(),
  value: z.string(),
  normalizedValue: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const RequisiteProviderBranchIdentifierSchema =
  RequisiteProviderIdentifierSchema;

export const RequisiteProviderBranchSchema = z.object({
  id: z.uuid(),
  providerId: z.uuid(),
  code: z.string().nullable(),
  name: z.string(),
  country: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  rawAddress: z.string().nullable(),
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
  displayName: z.string(),
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
