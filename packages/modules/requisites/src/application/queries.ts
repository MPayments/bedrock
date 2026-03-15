import type { RequisitesRepository } from "./ports";

export interface RequisiteQueryRecord {
  id: string;
  ownerType: "organization" | "counterparty";
  organizationId: string | null;
  counterpartyId: string | null;
  label: string;
}

export interface RequisitesQueries {
  listRequisitesById: (ids: string[]) => Promise<RequisiteQueryRecord[]>;
  listLabelsById: (ids: string[]) => Promise<Map<string, string>>;
}

export function createRequisitesQueryHandlers(input: {
  requisites: RequisitesRepository;
}): RequisitesQueries {
  const { requisites } = input;

  return {
    listRequisitesById(ids: string[]) {
      return requisites.listRequisitesById(ids);
    },
    listLabelsById(ids: string[]) {
      return requisites.listLabelsById(ids);
    },
  };
}
