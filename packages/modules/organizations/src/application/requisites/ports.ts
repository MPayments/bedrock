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

export interface OrganizationRequisitesCommandTxRepository {
  findRequisiteSnapshotById: (
    id: string,
  ) => Promise<OrganizationRequisiteSnapshot | null>;
  findActiveRequisiteSnapshotById: (
    id: string,
  ) => Promise<OrganizationRequisiteSnapshot | null>;
  listActiveRequisitesByOrganizationCurrency: (input: {
    organizationId: string;
    currencyId: string;
  }) => Promise<OrganizationRequisiteSnapshot[]>;
  insertRequisite: (
    requisite: OrganizationRequisiteSnapshot,
  ) => Promise<OrganizationRequisiteSnapshot>;
  updateRequisite: (
    requisite: OrganizationRequisiteSnapshot,
  ) => Promise<OrganizationRequisiteSnapshot | null>;
  setDefaultState: (input: {
    organizationId: string;
    currencyId: string;
    defaultId: string | null;
    demotedIds: string[];
  }) => Promise<void>;
  archiveRequisite: (input: {
    requisiteId: string;
    archivedAt: Date;
  }) => Promise<boolean>;
  findBindingByRequisiteId: (
    requisiteId: string,
  ) => Promise<OrganizationRequisiteAccountingBinding | null>;
  upsertBinding: (input: {
    requisiteId: string;
    bookId: string;
    bookAccountInstanceId: string;
    postingAccountNo: string;
  }) => Promise<OrganizationRequisiteAccountingBinding | null>;
}
