import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { RequisiteOwnerType } from "../../domain/owner";
import type {
  ListRequisiteOptionsQuery,
  ListRequisitesQuery,
  Requisite,
  RequisiteListItem,
  RequisiteOption,
} from "../contracts/requisites";

export interface RequisiteOptionRecord extends Omit<RequisiteOption, "label"> {
  accountNo: string | null;
  accountRef: string | null;
  address: string | null;
  assetCode: string | null;
  label: string;
  currencyCode: string;
  beneficiaryName: string | null;
  contact: string | null;
  iban: string | null;
  memoTag: string | null;
  network: string | null;
  notes: string | null;
  subaccountRef: string | null;
}

export interface RequisiteSubjectRecord {
  requisiteId: string;
  ownerType: RequisiteOwnerType;
  ownerId: string;
  organizationId: string | null;
  currencyId: string;
  currencyCode: string;
}

export interface RequisiteReads {
  findById(id: string): Promise<Requisite | null>;
  findActiveById(id: string): Promise<Requisite | null>;
  listActiveBankByCounterpartyId(
    counterpartyId: string,
  ): Promise<RequisiteListItem[]>;
  list(query: ListRequisitesQuery): Promise<PaginatedList<RequisiteListItem>>;
  listOptions(query: ListRequisiteOptionsQuery): Promise<RequisiteOptionRecord[]>;
  listLabelsById(ids: string[]): Promise<Map<string, string>>;
  findSubjectById(requisiteId: string): Promise<RequisiteSubjectRecord | null>;
  listSubjectsById(requisiteIds: string[]): Promise<RequisiteSubjectRecord[]>;
}
