import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  CreateRequisiteInput,
  CreateRequisiteProviderInput,
  ListRequisiteOptionsQuery,
  ListRequisiteProvidersQuery,
  ListRequisitesQuery,
  Requisite,
  RequisiteAccountingBinding,
  RequisiteOption,
  RequisiteOwnerType,
  RequisiteProvider,
  UpdateRequisiteInput,
  UpdateRequisiteProviderInput,
} from "../contracts";

export interface RequisitesOwnersPort {
  assertOrganizationExists: (id: string) => Promise<void>;
  assertCounterpartyExists: (id: string) => Promise<void>;
}

export interface RequisitesCurrenciesPort {
  assertCurrencyExists: (id: string) => Promise<void>;
  listCodesById: (ids: string[]) => Promise<Map<string, string>>;
}

export interface RequisitesLedgerBindingsPort {
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

export interface RequisiteBindingResolution {
  requisiteId: string;
  organizationId: string;
  bookId: string;
  bookAccountInstanceId: string;
  currencyId: string;
  currencyCode: string;
  postingAccountNo: string;
}

export interface RequisiteOptionRecord extends RequisiteOption {
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

export interface RequisitesRepository {
  findRequisiteById: (
    id: string,
    queryable?: Queryable,
  ) => Promise<Requisite | null>;
  findActiveRequisiteById: (
    id: string,
    queryable?: Queryable,
  ) => Promise<Requisite | null>;
  listRequisites: (
    input: ListRequisitesQuery,
    queryable?: Queryable,
  ) => Promise<PaginatedList<Requisite>>;
  listRequisiteOptions: (
    input: ListRequisiteOptionsQuery,
    queryable?: Queryable,
  ) => Promise<RequisiteOptionRecord[]>;
  listRequisitesById: (
    ids: string[],
    queryable?: Queryable,
  ) => Promise<
    {
      id: string;
      ownerType: RequisiteOwnerType;
      organizationId: string | null;
      counterpartyId: string | null;
      label: string;
    }[]
  >;
  listLabelsById: (
    ids: string[],
    queryable?: Queryable,
  ) => Promise<Map<string, string>>;
  countActiveRequisitesByOwnerCurrency: (
    input: {
      ownerType: RequisiteOwnerType;
      ownerId: string;
      currencyId: string;
    },
    queryable?: Queryable,
  ) => Promise<number>;
  clearOtherDefaultsTx: (
    tx: Transaction,
    input: {
      ownerType: RequisiteOwnerType;
      ownerId: string;
      currencyId: string;
      currentId: string;
    },
  ) => Promise<void>;
  promoteNextDefaultTx: (
    tx: Transaction,
    input: {
      ownerType: RequisiteOwnerType;
      ownerId: string;
      currencyId: string;
      excludeId: string;
    },
  ) => Promise<void>;
  insertRequisiteTx: (
    tx: Transaction,
    input: CreateRequisiteInput & { isDefault: boolean },
  ) => Promise<Requisite>;
  updateRequisiteTx: (
    tx: Transaction,
    id: string,
    input: UpdateRequisiteInput & {
      providerId: string;
      currencyId: string;
      kind: Requisite["kind"];
      isDefault: boolean;
    },
  ) => Promise<Requisite | null>;
  archiveRequisiteTx: (tx: Transaction, id: string) => Promise<boolean>;

  findProviderById: (
    id: string,
    queryable?: Queryable,
  ) => Promise<RequisiteProvider | null>;
  findActiveProviderById: (
    id: string,
    queryable?: Queryable,
  ) => Promise<RequisiteProvider | null>;
  listProviders: (
    input: ListRequisiteProvidersQuery,
    queryable?: Queryable,
  ) => Promise<PaginatedList<RequisiteProvider>>;
  insertProvider: (
    input: CreateRequisiteProviderInput,
    queryable?: Queryable,
  ) => Promise<RequisiteProvider>;
  updateProvider: (
    id: string,
    input: UpdateRequisiteProviderInput,
    queryable?: Queryable,
  ) => Promise<RequisiteProvider | null>;
  archiveProvider: (id: string, queryable?: Queryable) => Promise<boolean>;

  findBindingByRequisiteId: (
    requisiteId: string,
    queryable?: Queryable,
  ) => Promise<RequisiteAccountingBinding | null>;
  upsertBindingTx: (
    tx: Transaction,
    input: {
      requisiteId: string;
      bookId: string;
      bookAccountInstanceId: string;
      postingAccountNo: string;
    },
  ) => Promise<RequisiteAccountingBinding | null>;
  listResolvedBindingsById: (
    requisiteIds: string[],
    queryable?: Queryable,
  ) => Promise<RequisiteBindingResolution[]>;
}
