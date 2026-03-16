import type { Transaction } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  ListRequisiteOptionsQuery,
  ListRequisitesQuery,
  Requisite,
  RequisiteOption,
} from "../../contracts";
import type { RequisiteSnapshot } from "../../domain/requisite";
import type { RequisiteOwnerType } from "../../domain/owner";

export interface RequisiteOptionRecord extends Omit<RequisiteOption, "label"> {
  label: string;
  currencyCode: string;
  beneficiaryName: string | null;
  institutionName: string | null;
  institutionCountry: string | null;
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

export interface RequisitesQueryRepository {
  findRequisiteById: (id: string, tx?: Transaction) => Promise<Requisite | null>;
  findActiveRequisiteById: (
    id: string,
    tx?: Transaction,
  ) => Promise<Requisite | null>;
  listRequisites: (
    input: ListRequisitesQuery,
    tx?: Transaction,
  ) => Promise<PaginatedList<Requisite>>;
  listRequisiteOptions: (
    input: ListRequisiteOptionsQuery,
    tx?: Transaction,
  ) => Promise<RequisiteOptionRecord[]>;
  listLabelsById: (
    ids: string[],
    tx?: Transaction,
  ) => Promise<Map<string, string>>;
  findSubjectById: (
    requisiteId: string,
    tx?: Transaction,
  ) => Promise<RequisiteSubjectRecord | null>;
  listSubjectsById: (
    requisiteIds: string[],
    tx?: Transaction,
  ) => Promise<RequisiteSubjectRecord[]>;
}

export interface RequisitesCommandRepository {
  findRequisiteSnapshotById: (
    id: string,
    tx?: Transaction,
  ) => Promise<RequisiteSnapshot | null>;
  findActiveRequisiteSnapshotById: (
    id: string,
    tx?: Transaction,
  ) => Promise<RequisiteSnapshot | null>;
  listActiveRequisitesByOwnerCurrency: (
    input: {
      ownerType: RequisiteOwnerType;
      ownerId: string;
      currencyId: string;
    },
    tx?: Transaction,
  ) => Promise<RequisiteSnapshot[]>;
  insertRequisite: (
    requisite: RequisiteSnapshot,
    tx?: Transaction,
  ) => Promise<RequisiteSnapshot>;
  updateRequisite: (
    requisite: RequisiteSnapshot,
    tx?: Transaction,
  ) => Promise<RequisiteSnapshot | null>;
  setDefaultState: (
    input: {
      ownerType: RequisiteOwnerType;
      ownerId: string;
      currencyId: string;
      defaultId: string | null;
      demotedIds: string[];
    },
    tx?: Transaction,
  ) => Promise<void>;
  archiveRequisite: (
    input: {
      requisiteId: string;
      archivedAt: Date;
    },
    tx?: Transaction,
  ) => Promise<boolean>;
}
