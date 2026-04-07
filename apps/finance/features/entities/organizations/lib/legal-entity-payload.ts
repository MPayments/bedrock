import type { OrganizationGeneralFormValues } from "../components/organization-form";
import type { SerializedOrganization } from "./types";

export function buildOrganizationLegalEntityPayload(
  values: OrganizationGeneralFormValues,
  current: SerializedOrganization["legalEntity"],
) {
  return {
    profile: {
      fullName: values.fullName,
      shortName: values.shortName,
      fullNameI18n: current?.profile.fullNameI18n ?? null,
      shortNameI18n: current?.profile.shortNameI18n ?? null,
      legalFormCode: current?.profile.legalFormCode ?? null,
      legalFormLabel: current?.profile.legalFormLabel ?? null,
      legalFormLabelI18n: current?.profile.legalFormLabelI18n ?? null,
      countryCode: values.country || null,
      businessActivityCode: current?.profile.businessActivityCode ?? null,
      businessActivityText: current?.profile.businessActivityText ?? null,
    },
    identifiers: current?.identifiers ?? [],
    addresses: current?.addresses ?? [],
    contacts: current?.contacts ?? [],
    representatives: current?.representatives ?? [],
    licenses: current?.licenses ?? [],
  };
}
