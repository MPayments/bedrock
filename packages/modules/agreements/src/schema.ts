import {
  agreementFeeRules,
  agreementFeeRuleKindEnum,
  agreementFeeRuleUnitEnum,
  agreementParties,
  agreementPartyRoleEnum,
  agreements,
  agreementVersions,
} from "./adapters/drizzle/schema";

export {
  agreementFeeRules,
  agreementFeeRuleKindEnum,
  agreementFeeRuleUnitEnum,
  agreementParties,
  agreementPartyRoleEnum,
  agreements,
  agreementVersions,
};

export const schema = {
  agreements,
  agreementVersions,
  agreementFeeRules,
  agreementParties,
  agreementFeeRuleKindEnum,
  agreementFeeRuleUnitEnum,
  agreementPartyRoleEnum,
};
