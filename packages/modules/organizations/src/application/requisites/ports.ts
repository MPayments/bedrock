import type { Transaction } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  ListOrganizationRequisiteOptionsQuery,
  ListOrganizationRequisitesQuery,
  OrganizationRequisite,
  OrganizationRequisiteAccountingBinding,
  OrganizationRequisiteOption,
} from "../../contracts";
import type { OrganizationRequisiteSnapshot } from "../../domain/organization-requisite";

export interface OrganizationRequisiteOptionRecord extends Omit<
  OrganizationRequisiteOption,
  "ownerType" | "ownerId"
> {
  ownerId: string;
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

export interface OrganizationsRequisiteBindingResolution {
  requisiteId: string;
  organizationId: string;
  bookId: string;
  bookAccountInstanceId: string;
  currencyId: string;
  currencyCode: string;
  postingAccountNo: string;
}

export interface OrganizationRequisitesQueryRepository {
  findRequisiteById: (id: string) => Promise<OrganizationRequisite | null>;
  findActiveRequisiteById: (
    id: string,
  ) => Promise<OrganizationRequisite | null>;
  listRequisites: (
    input: ListOrganizationRequisitesQuery,
  ) => Promise<PaginatedList<OrganizationRequisite>>;
  listRequisiteOptions: (
    input: ListOrganizationRequisiteOptionsQuery,
  ) => Promise<OrganizationRequisiteOptionRecord[]>;
  listLabelsById: (ids: string[]) => Promise<Map<string, string>>;
  findBindingByRequisiteId: (
    requisiteId: string,
  ) => Promise<OrganizationRequisiteAccountingBinding | null>;
  listResolvedBindingsById: (
    requisiteIds: string[],
  ) => Promise<OrganizationsRequisiteBindingResolution[]>;
}

export interface OrganizationRequisitesCommandRepository {
  findRequisiteSnapshotById: (
    id: string,
    tx?: Transaction,
  ) => Promise<OrganizationRequisiteSnapshot | null>;
  findActiveRequisiteSnapshotById: (
    id: string,
    tx?: Transaction,
  ) => Promise<OrganizationRequisiteSnapshot | null>;
  listActiveRequisitesByOrganizationCurrency: (
    input: {
      organizationId: string;
      currencyId: string;
    },
    tx?: Transaction,
  ) => Promise<OrganizationRequisiteSnapshot[]>;
  insertRequisiteTx: (
    tx: Transaction,
    requisite: OrganizationRequisiteSnapshot,
  ) => Promise<OrganizationRequisiteSnapshot>;
  updateRequisiteTx: (
    tx: Transaction,
    requisite: OrganizationRequisiteSnapshot,
  ) => Promise<OrganizationRequisiteSnapshot | null>;
  setDefaultStateTx: (
    tx: Transaction,
    input: {
      organizationId: string;
      currencyId: string;
      defaultId: string | null;
      demotedIds: string[];
    },
  ) => Promise<void>;
  archiveRequisiteTx: (
    tx: Transaction,
    input: {
      requisiteId: string;
      archivedAt: Date;
    },
  ) => Promise<boolean>;
  findBindingByRequisiteId: (
    requisiteId: string,
    tx?: Transaction,
  ) => Promise<OrganizationRequisiteAccountingBinding | null>;
  upsertBindingTx: (
    tx: Transaction,
    input: {
      requisiteId: string;
      bookId: string;
      bookAccountInstanceId: string;
      postingAccountNo: string;
    },
  ) => Promise<OrganizationRequisiteAccountingBinding | null>;
}
