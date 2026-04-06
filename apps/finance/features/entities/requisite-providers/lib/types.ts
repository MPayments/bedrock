import type { ListResult } from "@/features/entities/shared/lib/list-result";

export type SerializedRequisiteProvider = {
  id: string;
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  name: string;
  legalName: string;
  displayName: string;
  description: string;
  country: string;
  address: string;
  contact: string;
  bic: string;
  swift: string;
  jurisdictionCode: string | null;
  website: string | null;
  primaryBranchId: string | null;
  primaryBranchName: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RequisiteProvidersListResult = ListResult<SerializedRequisiteProvider>;
