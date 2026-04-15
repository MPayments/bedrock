import { z } from "zod";

import {
  AGREEMENT_FEE_RULE_KIND_VALUES,
  AGREEMENT_FEE_RULE_UNIT_VALUES,
  AGREEMENT_PARTY_ROLE_VALUES,
  AGREEMENT_ROUTE_POLICY_COMMISSION_UNIT_VALUES,
  AGREEMENT_ROUTE_POLICY_DEAL_TYPE_VALUES,
  AGREEMENT_ROUTE_TEMPLATE_STATUS_VALUES,
} from "../../domain/constants";

export const AgreementFeeRuleKindSchema = z.enum(
  AGREEMENT_FEE_RULE_KIND_VALUES,
);
export const AgreementFeeRuleUnitSchema = z.enum(
  AGREEMENT_FEE_RULE_UNIT_VALUES,
);
export const AgreementPartyRoleSchema = z.enum(AGREEMENT_PARTY_ROLE_VALUES);
export const AgreementRoutePolicyDealTypeSchema = z.enum(
  AGREEMENT_ROUTE_POLICY_DEAL_TYPE_VALUES,
);
export const AgreementRoutePolicyCommissionUnitSchema = z.enum(
  AGREEMENT_ROUTE_POLICY_COMMISSION_UNIT_VALUES,
);
export const AgreementRouteTemplateStatusSchema = z.enum(
  AGREEMENT_ROUTE_TEMPLATE_STATUS_VALUES,
);

export type AgreementFeeRuleKind = z.infer<typeof AgreementFeeRuleKindSchema>;
export type AgreementFeeRuleUnit = z.infer<typeof AgreementFeeRuleUnitSchema>;
export type AgreementPartyRole = z.infer<typeof AgreementPartyRoleSchema>;
export type AgreementRoutePolicyDealType = z.infer<
  typeof AgreementRoutePolicyDealTypeSchema
>;
export type AgreementRoutePolicyCommissionUnit = z.infer<
  typeof AgreementRoutePolicyCommissionUnitSchema
>;
export type AgreementRouteTemplateStatus = z.infer<
  typeof AgreementRouteTemplateStatusSchema
>;
