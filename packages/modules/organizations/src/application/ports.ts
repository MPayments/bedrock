import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  CreateOrganizationInput,
  CreateOrganizationRequisiteInput,
  ListOrganizationsQuery,
  ListOrganizationRequisiteOptionsQuery,
  ListOrganizationRequisitesQuery,
  Organization,
  OrganizationRequisite,
  OrganizationRequisiteAccountingBinding,
  OrganizationRequisiteOption,
  UpdateOrganizationInput,
  UpdateOrganizationRequisiteInput,
} from "../contracts";

export interface OrganizationsLedgerBooksPort {
  ensureDefaultOrganizationBook: (
    tx: Transaction,
    input: { organizationId: string },
  ) => Promise<{ bookId: string }>;
}

export interface OrganizationsLedgerReadPort {
  listBooksById: (
    bookIds: string[],
  ) => Promise<
    {
      id: string;
      ownerId: string | null;
    }[]
  >;
}

export interface OrganizationsCurrenciesPort {
  assertCurrencyExists: (id: string) => Promise<void>;
  listCodesById: (ids: string[]) => Promise<Map<string, string>>;
}

export interface OrganizationsRequisiteProvidersPort {
  assertProviderActive: (id: string) => Promise<void>;
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

export interface OrganizationsLedgerBindingsPort {
  ensureOrganizationPostingTarget: (
    tx: Transaction,
    input: {
      organizationId: string;
      currencyCode: string;
      postingAccountNo: string;
    },
  ) => Promise<{
    bookId: string;
    bookAccountInstanceId: string;
  }>;
}

export interface OrganizationsRepository {
  insertOrganizationTx: (
    tx: Transaction,
    input: CreateOrganizationInput,
  ) => Promise<Organization>;
  findOrganizationById: (id: string) => Promise<Organization | null>;
  listOrganizations: (
    input: ListOrganizationsQuery,
  ) => Promise<PaginatedList<Organization>>;
  updateOrganization: (
    id: string,
    input: UpdateOrganizationInput,
  ) => Promise<Organization | null>;
  removeOrganization: (id: string) => Promise<boolean>;
  listInternalLedgerOrganizations: () => Promise<
    {
      id: string;
      shortName: string;
    }[]
  >;
  listShortNamesById: (ids: string[]) => Promise<Map<string, string>>;
  listExistingOrganizationIds: (ids: string[]) => Promise<string[]>;
}

export interface OrganizationRequisiteOptionRecord extends OrganizationRequisiteOption {
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

export interface OrganizationRequisitesRepository {
  findRequisiteById: (
    id: string,
    queryable?: Queryable,
  ) => Promise<OrganizationRequisite | null>;
  findActiveRequisiteById: (
    id: string,
    queryable?: Queryable,
  ) => Promise<OrganizationRequisite | null>;
  listRequisites: (
    input: ListOrganizationRequisitesQuery,
    queryable?: Queryable,
  ) => Promise<PaginatedList<OrganizationRequisite>>;
  listRequisiteOptions: (
    input: ListOrganizationRequisiteOptionsQuery,
    queryable?: Queryable,
  ) => Promise<OrganizationRequisiteOptionRecord[]>;
  listLabelsById: (
    ids: string[],
    queryable?: Queryable,
  ) => Promise<Map<string, string>>;
  countActiveRequisitesByOrganizationCurrency: (
    input: {
      organizationId: string;
      currencyId: string;
    },
    queryable?: Queryable,
  ) => Promise<number>;
  clearOtherDefaultsTx: (
    tx: Transaction,
    input: {
      organizationId: string;
      currencyId: string;
      currentId: string;
    },
  ) => Promise<void>;
  promoteNextDefaultTx: (
    tx: Transaction,
    input: {
      organizationId: string;
      currencyId: string;
      excludeId: string;
    },
  ) => Promise<void>;
  insertRequisiteTx: (
    tx: Transaction,
    input: CreateOrganizationRequisiteInput & { isDefault: boolean },
  ) => Promise<OrganizationRequisite>;
  updateRequisiteTx: (
    tx: Transaction,
    id: string,
    input: UpdateOrganizationRequisiteInput & {
      providerId: string;
      currencyId: string;
      kind: OrganizationRequisite["kind"];
      isDefault: boolean;
    },
  ) => Promise<OrganizationRequisite | null>;
  archiveRequisiteTx: (tx: Transaction, id: string) => Promise<boolean>;
  findBindingByRequisiteId: (
    requisiteId: string,
    queryable?: Queryable,
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
  listResolvedBindingsById: (
    requisiteIds: string[],
    queryable?: Queryable,
  ) => Promise<OrganizationsRequisiteBindingResolution[]>;
}
