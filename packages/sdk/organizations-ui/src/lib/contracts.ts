export type OrganizationKind = "legal_entity" | "individual";

export interface OrganizationListItem {
  id: string;
  shortName: string;
  fullName: string;
  country: string | null;
  kind: OrganizationKind;
  updatedAt: string;
}
