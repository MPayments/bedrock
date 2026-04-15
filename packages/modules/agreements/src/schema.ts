import {
  agreementFeeRules,
  agreementFeeRuleKindEnum,
  agreementFeeRuleUnitEnum,
  agreementParties,
  agreementPartyRoleEnum,
  agreementRoutePolicies,
  agreementRoutePolicyCommissionUnitEnum,
  agreementRoutePolicyDealTypeEnum,
  agreementRouteTemplateLinks,
  agreements,
  agreementVersions,
} from "./adapters/drizzle/schema";

export {
  agreementFeeRules,
  agreementFeeRuleKindEnum,
  agreementFeeRuleUnitEnum,
  agreementParties,
  agreementPartyRoleEnum,
  agreementRoutePolicies,
  agreementRoutePolicyCommissionUnitEnum,
  agreementRoutePolicyDealTypeEnum,
  agreementRouteTemplateLinks,
  agreements,
  agreementVersions,
};

export const schema = {
  agreements,
  agreementVersions,
  agreementFeeRules,
  agreementParties,
  agreementRoutePolicies,
  agreementRouteTemplateLinks,
  agreementFeeRuleKindEnum,
  agreementFeeRuleUnitEnum,
  agreementPartyRoleEnum,
  agreementRoutePolicyDealTypeEnum,
  agreementRoutePolicyCommissionUnitEnum,
};
