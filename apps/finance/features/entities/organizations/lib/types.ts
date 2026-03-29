import type { ListResult } from "@/features/entities/shared/lib/list-result";

export type SerializedOrganization = {
  id: string;
  externalId: string | null;
  shortName: string;
  fullName: string;
  description: string | null;
  country: string | null;
  kind: "legal_entity" | "individual";
  createdAt: string;
  updatedAt: string;
};

export type OrganizationsListResult = ListResult<SerializedOrganization>;
