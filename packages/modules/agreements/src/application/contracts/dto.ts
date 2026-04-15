import { z } from "zod";

import {
  createPaginatedListSchema,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  AgreementFeeRuleKindSchema,
  AgreementFeeRuleUnitSchema,
  AgreementPartyRoleSchema,
  AgreementRoutePolicyCommissionUnitSchema,
  AgreementRoutePolicyDealTypeSchema,
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

export const AgreementRouteTemplateLinkSchema = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  isDefault: z.boolean(),
  routeTemplateId: z.uuid(),
  sequence: z.number().int().positive(),
  updatedAt: z.date(),
});

export type AgreementRouteTemplateLink = z.infer<
  typeof AgreementRouteTemplateLinkSchema
>;

export const AgreementRoutePolicySchema = z.object({
  agreementVersionId: z.uuid(),
  approvalThresholdAmountMinor: z.string().nullable(),
  approvalThresholdCurrencyCode: z.string().nullable(),
  approvalThresholdCurrencyId: z.uuid().nullable(),
  createdAt: z.date(),
  defaultMarkupBps: z.string().nullable(),
  defaultSubAgentCommissionAmountMinor: z.string().nullable(),
  defaultSubAgentCommissionBps: z.string().nullable(),
  defaultSubAgentCommissionCurrencyCode: z.string().nullable(),
  defaultSubAgentCommissionCurrencyId: z.uuid().nullable(),
  defaultSubAgentCommissionUnit:
    AgreementRoutePolicyCommissionUnitSchema.nullable(),
  defaultWireFeeAmountMinor: z.string().nullable(),
  defaultWireFeeCurrencyCode: z.string().nullable(),
  defaultWireFeeCurrencyId: z.uuid().nullable(),
  dealType: AgreementRoutePolicyDealTypeSchema,
  id: z.uuid(),
  quoteValiditySeconds: z.number().int().positive().nullable(),
  sequence: z.number().int().positive(),
  sourceCurrencyCode: z.string().nullable(),
  sourceCurrencyId: z.uuid().nullable(),
  targetCurrencyCode: z.string().nullable(),
  targetCurrencyId: z.uuid().nullable(),
  templateLinks: z.array(AgreementRouteTemplateLinkSchema),
  updatedAt: z.date(),
});

export type AgreementRoutePolicy = z.infer<typeof AgreementRoutePolicySchema>;

export const AgreementVersionSummarySchema = z.object({
  id: z.uuid(),
  versionNumber: z.number().int(),
  contractNumber: z.string().nullable(),
  contractDate: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AgreementVersionSummary = z.infer<
  typeof AgreementVersionSummarySchema
>;

export const AgreementVersionSchema = AgreementVersionSummarySchema.extend({
  feeRules: z.array(AgreementFeeRuleSchema),
  parties: z.array(AgreementPartySchema),
  routePolicies: z.array(AgreementRoutePolicySchema),
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

export const AgreementResolvedRouteDefaultsSchema = z.object({
  agreementId: z.uuid(),
  agreementVersionId: z.uuid(),
  policy: AgreementRoutePolicySchema.nullable(),
});

export type AgreementResolvedRouteDefaults = z.infer<
  typeof AgreementResolvedRouteDefaultsSchema
>;

export const PaginatedAgreementsSchema =
  createPaginatedListSchema(AgreementSchema);

export type PaginatedAgreements = PaginatedList<Agreement>;
