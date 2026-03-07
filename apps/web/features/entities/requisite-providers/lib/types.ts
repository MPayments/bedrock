import type { ListResult } from "@/features/entities/shared/lib/list-result";

export type SerializedRequisiteProvider = {
  id: string;
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  name: string;
  description: string | null;
  country: string | null;
  address: string | null;
  contact: string | null;
  bic: string | null;
  swift: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RequisiteProvidersListResult = ListResult<SerializedRequisiteProvider>;
