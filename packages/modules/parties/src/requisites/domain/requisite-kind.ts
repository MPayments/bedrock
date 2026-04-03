export const REQUISITE_KIND_VALUES = [
  "bank",
  "exchange",
  "blockchain",
  "custodian",
] as const;

export type RequisiteKind = (typeof REQUISITE_KIND_VALUES)[number];

export function isBankLikeRequisiteKind(kind: RequisiteKind): boolean {
  return kind === "bank" || kind === "exchange" || kind === "custodian";
}
