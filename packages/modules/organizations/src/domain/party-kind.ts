export const PARTY_KIND_VALUES = ["legal_entity", "individual"] as const;

export type PartyKind = (typeof PARTY_KIND_VALUES)[number];
