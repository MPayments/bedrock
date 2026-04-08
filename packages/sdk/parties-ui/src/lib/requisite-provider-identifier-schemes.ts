import type {
  RequisiteProviderBranchIdentifierSchemeValue,
  RequisiteProviderIdentifierSchemeValue,
} from "@bedrock/parties/contracts";
import {
  REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_VALUES,
  REQUISITE_PROVIDER_IDENTIFIER_SCHEME_VALUES,
} from "@bedrock/parties/contracts";

export const REQUISITE_PROVIDER_IDENTIFIER_SCHEME_LABELS: Record<
  RequisiteProviderIdentifierSchemeValue,
  string
> = {
  bic: "BIC",
  swift: "SWIFT",
};

export const REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_LABELS: Record<
  RequisiteProviderBranchIdentifierSchemeValue,
  string
> = {
  bic: "BIC",
  branch_code: "Код филиала банка",
  swift: "SWIFT",
};

export const REQUISITE_PROVIDER_IDENTIFIER_SCHEME_OPTIONS =
  REQUISITE_PROVIDER_IDENTIFIER_SCHEME_VALUES.map((value) => ({
    value,
    label: REQUISITE_PROVIDER_IDENTIFIER_SCHEME_LABELS[value],
  }));

export const REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_OPTIONS =
  REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_VALUES.map((value) => ({
    value,
    label: REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_LABELS[value],
  }));
