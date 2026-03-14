import type { Database, Transaction } from "@bedrock/platform/persistence";

import type {
  ReportAttributionMode,
  ReportScopeType,
} from "../../contracts/reporting";
import type {
  FinancialResultStatus,
  LineMapping,
  ReportScopeMeta,
  ResolvedScope,
  ScopedPosting,
} from "../../domain/reports/types";

export type * from "../../domain/reports/types";

export interface AccountingReportsContext {
  db: Database | Transaction;
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
}
