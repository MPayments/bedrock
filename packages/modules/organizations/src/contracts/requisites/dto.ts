import { z } from "zod";

import { RequisiteKindSchema } from "@bedrock/shared/requisites";

export const OrganizationRequisiteSchema = z.object({
  id: z.uuid(),
  ownerType: z.literal("organization"),
  ownerId: z.uuid(),
  providerId: z.uuid(),
  currencyId: z.uuid(),
  kind: RequisiteKindSchema,
  label: z.string(),
  description: z.string().nullable(),
  beneficiaryName: z.string().nullable(),
  institutionName: z.string().nullable(),
  institutionCountry: z.string().nullable(),
  accountNo: z.string().nullable(),
  corrAccount: z.string().nullable(),
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  swift: z.string().nullable(),
  bankAddress: z.string().nullable(),
  network: z.string().nullable(),
  assetCode: z.string().nullable(),
  address: z.string().nullable(),
  memoTag: z.string().nullable(),
  accountRef: z.string().nullable(),
  subaccountRef: z.string().nullable(),
  contact: z.string().nullable(),
  notes: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  archivedAt: z.date().nullable(),
});

export type OrganizationRequisite = z.infer<typeof OrganizationRequisiteSchema>;

export const OrganizationRequisiteAccountingBindingSchema = z.object({
  requisiteId: z.uuid(),
  organizationId: z.uuid(),
  bookId: z.uuid(),
  bookAccountInstanceId: z.uuid(),
  postingAccountNo: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type OrganizationRequisiteAccountingBinding = z.infer<
  typeof OrganizationRequisiteAccountingBindingSchema
>;

export const OrganizationRequisiteOptionSchema = z.object({
  id: z.uuid(),
  ownerType: z.literal("organization"),
  ownerId: z.uuid(),
  currencyId: z.uuid(),
  providerId: z.uuid(),
  kind: RequisiteKindSchema,
  label: z.string(),
});

export const OrganizationRequisiteOptionsResponseSchema = z.object({
  data: z.array(OrganizationRequisiteOptionSchema),
});

export type OrganizationRequisiteOption = z.infer<
  typeof OrganizationRequisiteOptionSchema
>;
