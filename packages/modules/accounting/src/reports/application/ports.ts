import type {
  LedgerOperationDetails,
  LedgerOperationList,
  ListLedgerOperationsInput,
} from "@bedrock/ledger/contracts";

import type { AccountingClosePackageRecord } from "../../periods/domain";
import type {
  FinancialResultStatus,
  LineMapping,
  ReportAttributionMode,
  ReportScopeMeta,
  ReportScopeType,
  ResolvedScope,
  ScopedPosting,
} from "../domain";

export type * from "../domain";

export interface AccountingReportsDocumentRef {
  operationId: string;
  documentId: string;
  documentType: string;
  channel: string | null;
}

export interface AccountingReportsLedgerPort {
  listOperations: (
    input?: ListLedgerOperationsInput,
  ) => Promise<LedgerOperationList>;
  listOperationDetails: (
    operationIds: string[],
  ) => Promise<Map<string, LedgerOperationDetails>>;
  getOperationDetails: (
    operationId: string,
  ) => Promise<LedgerOperationDetails | null>;
}

export interface AccountingReportsDocumentsPort {
  listOperationDocumentRefs: (
    operationIds: string[],
  ) => Promise<Map<string, AccountingReportsDocumentRef>>;
}

export interface AccountingReportsContext {
  keyByParts: (...parts: (string | null | undefined)[]) => string;
  listInternalLedgerOrganizationIds: () => Promise<string[]>;
  resolveScope: (input: {
    scopeType: ReportScopeType;
    counterpartyIds: string[];
    groupIds: string[];
    bookIds: string[];
    includeDescendants: boolean;
  }) => Promise<ResolvedScope>;
  buildScopeMeta: (input: {
    scope: ResolvedScope;
    attributionMode: ReportAttributionMode;
    hasUnattributedData: boolean;
  }) => ReportScopeMeta;
  fetchScopedPostings: (input: {
    scope: ResolvedScope;
    attributionMode: ReportAttributionMode;
    statuses: FinancialResultStatus[];
    from?: Date;
    to?: Date;
    asOf?: Date;
    currency?: string;
    includeUnattributed: boolean;
  }) => Promise<ScopedPosting[]>;
  fetchCounterpartyNames: (ids: string[]) => Promise<Map<string, string>>;
  fetchAccountMeta: (
    accountNos: string[],
  ) => Promise<Map<string, { name: string; kind: string }>>;
  fetchLineMappings: (
    reportKind:
      | "balance_sheet"
      | "income_statement"
      | "cash_flow_direct"
      | "cash_flow_indirect"
      | "fx_revaluation"
      | "fee_revenue",
    asOf: Date,
  ) => Promise<Map<string, LineMapping[]>>;
  computeAccountNetMovements: (
    postings: ScopedPosting[],
  ) => Map<string, { accountNo: string; currency: string; netMinor: bigint }>;
  fetchLiquidityRows: (input: {
    scope: ResolvedScope;
    attributionMode: ReportAttributionMode;
    currency?: string;
  }) => Promise<
    {
      bookId: string;
      bookLabel: string;
      counterpartyId: string | null;
      counterpartyName: string | null;
      currency: string;
      ledgerBalanceMinor: bigint;
      availableMinor: bigint;
      reservedMinor: bigint;
      pendingMinor: bigint;
    }[]
  >;
  assertInternalOrganization: (organizationId: string) => Promise<void>;
  findLatestClosePackage: (input: {
    organizationId: string;
    periodStart: Date;
  }) => Promise<AccountingClosePackageRecord | null>;
}

export interface AccountingReportsServicePorts {
  listCurrencyPrecisionsByCode: (codes: string[]) => Promise<Map<string, number>>;
  listBookNamesById: (ids: string[]) => Promise<Map<string, string>>;
  resolveDimensionLabelsFromRecords: (input: {
    records: (Record<string, string> | null | undefined)[];
  }) => Promise<Record<string, Record<string, string>>>;
}

export type { ReportsReads } from "./ports/reports.reads";
