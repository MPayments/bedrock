import type { PaginatedList } from "@bedrock/shared/core/pagination";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

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
  findRequisiteById: (
    id: string,
    tx?: PersistenceSession,
  ) => Promise<Requisite | null>;
  findActiveRequisiteById: (
    id: string,
    tx?: PersistenceSession,
  ) => Promise<Requisite | null>;
  listRequisites: (
    input: ListRequisitesQuery,
    tx?: PersistenceSession,
  ) => Promise<PaginatedList<Requisite>>;
  listRequisiteOptions: (
    input: ListRequisiteOptionsQuery,
    tx?: PersistenceSession,
  ) => Promise<RequisiteOptionRecord[]>;
  listLabelsById: (
    ids: string[],
    tx?: PersistenceSession,
  ) => Promise<Map<string, string>>;
  findSubjectById: (
    requisiteId: string,
    tx?: PersistenceSession,
  ) => Promise<RequisiteSubjectRecord | null>;
  listSubjectsById: (
    requisiteIds: string[],
    tx?: PersistenceSession,
  ) => Promise<RequisiteSubjectRecord[]>;
}

export interface RequisitesCommandRepository {
  findRequisiteSnapshotById: (
    id: string,
    tx?: PersistenceSession,
  ) => Promise<RequisiteSnapshot | null>;
  findActiveRequisiteSnapshotById: (
    id: string,
    tx?: PersistenceSession,
  ) => Promise<RequisiteSnapshot | null>;
  listActiveRequisitesByOwnerCurrency: (
    input: {
      ownerType: RequisiteOwnerType;
      ownerId: string;
      currencyId: string;
    },
    tx?: PersistenceSession,
  ) => Promise<RequisiteSnapshot[]>;
  insertRequisite: (
    requisite: RequisiteSnapshot,
    tx?: PersistenceSession,
  ) => Promise<RequisiteSnapshot>;
  updateRequisite: (
    requisite: RequisiteSnapshot,
    tx?: PersistenceSession,
  ) => Promise<RequisiteSnapshot | null>;
  setDefaultState: (
    input: {
      ownerType: RequisiteOwnerType;
      ownerId: string;
      currencyId: string;
      defaultId: string | null;
      demotedIds: string[];
    },
    tx?: PersistenceSession,
  ) => Promise<void>;
  archiveRequisite: (
    input: {
      requisiteId: string;
      archivedAt: Date;
    },
    tx?: PersistenceSession,
  ) => Promise<boolean>;
}
