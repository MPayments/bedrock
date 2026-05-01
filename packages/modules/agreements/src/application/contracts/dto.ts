import { z } from "zod";

import {
  createPaginatedListSchema,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  AgreementFeeBillingModeSchema,
  AgreementFeeRuleKindSchema,
  AgreementFeeRuleUnitSchema,
  AgreementPartyRoleSchema,
} from "./zod";

export const AgreementFeeRuleSchema = z.object({
  id: z.uuid(),
  kind: AgreementFeeRuleKindSchema,
  unit: AgreementFeeRuleUnitSchema,
  value: z.string(),
  currencyId: z.uuid().nullable(),
  currencyCode: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AgreementFeeRule = z.infer<typeof AgreementFeeRuleSchema>;

export const AgreementPartySchema = z.object({
  id: z.uuid(),
  partyRole: AgreementPartyRoleSchema,
  partyId: z.uuid(),
  customerId: z.uuid().nullable(),
  organizationId: z.uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AgreementParty = z.infer<typeof AgreementPartySchema>;

export const AgreementVersionSummarySchema = z.object({
  id: z.uuid(),
  versionNumber: z.number().int(),
  contractNumber: z.string().nullable(),
  contractDate: z.date().nullable(),
  feeBillingMode: AgreementFeeBillingModeSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AgreementVersionSummary = z.infer<
  typeof AgreementVersionSummarySchema
>;

export const AgreementVersionSchema = AgreementVersionSummarySchema.extend({
  feeRules: z.array(AgreementFeeRuleSchema),
  parties: z.array(AgreementPartySchema),
});

export type AgreementVersion = z.infer<typeof AgreementVersionSchema>;

export const AgreementSchema = z.object({
  id: z.uuid(),
  customerId: z.uuid(),
  organizationId: z.uuid(),
  organizationRequisiteId: z.uuid(),
  isActive: z.boolean(),
  currentVersion: AgreementVersionSummarySchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Agreement = z.infer<typeof AgreementSchema>;

export const AgreementDetailsSchema = AgreementSchema.extend({
  currentVersion: AgreementVersionSchema,
});

export type AgreementDetails = z.infer<typeof AgreementDetailsSchema>;

export const PaginatedAgreementsSchema =
  createPaginatedListSchema(AgreementSchema);

export type PaginatedAgreements = PaginatedList<Agreement>;
