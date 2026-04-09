export function createLegalEntityPartyProfileBundle(input: {
  countryCode?: string | null;
  fullName: string;
  shortName: string;
}) {
  return {
    profile: {
      fullName: input.fullName,
      shortName: input.shortName,
      fullNameI18n: null,
      shortNameI18n: null,
      legalFormCode: null,
      legalFormLabel: null,
      legalFormLabelI18n: null,
      countryCode: input.countryCode ?? null,
      businessActivityCode: null,
      businessActivityText: null,
      businessActivityTextI18n: null,
    },
    identifiers: [],
    address: null,
    contacts: [],
    representatives: [],
    licenses: [],
  };
}
