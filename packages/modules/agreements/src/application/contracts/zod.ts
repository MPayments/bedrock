import { z } from "zod";

import {
  AGREEMENT_FEE_RULE_KIND_VALUES,
  AGREEMENT_FEE_RULE_UNIT_VALUES,
  AGREEMENT_PARTY_ROLE_VALUES,
} from "../../domain/constants";

export const AgreementFeeRuleKindSchema = z.enum(
  AGREEMENT_FEE_RULE_KIND_VALUES,
);
export const AgreementFeeRuleUnitSchema = z.enum(
  AGREEMENT_FEE_RULE_UNIT_VALUES,
);
export const AgreementPartyRoleSchema = z.enum(AGREEMENT_PARTY_ROLE_VALUES);

export type AgreementFeeRuleKind = z.infer<typeof AgreementFeeRuleKindSchema>;
export type AgreementFeeRuleUnit = z.infer<typeof AgreementFeeRuleUnitSchema>;
export type AgreementPartyRole = z.infer<typeof AgreementPartyRoleSchema>;
