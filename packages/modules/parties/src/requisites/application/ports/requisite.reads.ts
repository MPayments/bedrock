import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { RequisiteOwnerType } from "../../domain/owner";
import type {
  ListRequisiteOptionsQuery,
  ListRequisitesQuery,
  Requisite,
  RequisiteOption,
} from "../contracts/requisites";

export interface RequisiteOptionRecord extends Omit<RequisiteOption, "label"> {
  label: string;
  currencyCode: string;
  beneficiaryName: string | null;
  institutionName: string | null;
  accountNo: string | null;
  corrAccount: string | null;
  iban: string | null;
  bic: string | null;
  swift: string | null;
  bankAddress: string | null;
  network: string | null;
  assetCode: string | null;
  address: string | null;
  memoTag: string | null;
  accountRef: string | null;
  subaccountRef: string | null;
  contact: string | null;
  notes: string | null;
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
  list(query: ListRequisitesQuery): Promise<PaginatedList<Requisite>>;
  listOptions(query: ListRequisiteOptionsQuery): Promise<RequisiteOptionRecord[]>;
  listLabelsById(ids: string[]): Promise<Map<string, string>>;
  findSubjectById(requisiteId: string): Promise<RequisiteSubjectRecord | null>;
  listSubjectsById(requisiteIds: string[]): Promise<RequisiteSubjectRecord[]>;
}
