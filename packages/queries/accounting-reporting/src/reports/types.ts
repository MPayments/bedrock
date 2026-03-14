import type { Database } from "@bedrock/persistence";

import type {
  ReportAttributionMode,
  ReportScopeType,
} from "../reports-validation";

export type FinancialResultStatus = "pending" | "posted" | "failed";

export interface ReportScopeMeta {
  scopeType: ReportScopeType;
  requestedCounterpartyIds: string[];
  requestedGroupIds: string[];
  requestedBookIds: string[];
  resolvedCounterpartyIdsCount: number;
  attributionMode: ReportAttributionMode;
  hasUnattributedData: boolean;
}

export interface ResolvedScope {
  scopeType: ReportScopeType;
  requestedCounterpartyIds: string[];
  requestedGroupIds: string[];
  requestedBookIds: string[];
  resolvedCounterpartyIds: string[];
  resolvedBookIds: string[];
}

export interface ScopedPosting {
  operationId: string;
  lineNo: number;
  postingDate: Date;
  status: FinancialResultStatus;
  bookId: string;
  bookLabel: string | null;
  bookCounterpartyId: string | null;
  currency: string;
  amountMinor: bigint;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  analyticCounterpartyId: string | null;
  documentId: string | null;
  documentType: string | null;
  channel: string | null;
}

export interface TrialBalanceRow {
  accountNo: string;
  accountName: string | null;
  accountKind: string | null;
  currency: string;
  openingDebitMinor: bigint;
  openingCreditMinor: bigint;
  periodDebitMinor: bigint;
  periodCreditMinor: bigint;
  closingDebitMinor: bigint;
  closingCreditMinor: bigint;
}

export interface TrialBalanceSummaryByCurrency {
  currency: string;
  openingDebitMinor: bigint;
  openingCreditMinor: bigint;
  periodDebitMinor: bigint;
  periodCreditMinor: bigint;
  closingDebitMinor: bigint;
  closingCreditMinor: bigint;
}

export interface GeneralLedgerEntry {
  operationId: string;
  lineNo: number;
  postingDate: Date;
  bookId: string;
  bookLabel: string;
  accountNo: string;
  currency: string;
  postingCode: string;
  counterpartyId: string | null;
  debitMinor: bigint;
  creditMinor: bigint;
  runningBalanceMinor: bigint;
}

export interface GeneralLedgerBalance {
  accountNo: string;
  currency: string;
  balanceMinor: bigint;
}

export interface BalanceSheetRow {
  section: string;
  lineCode: string;
  lineLabel: string;
  currency: string;
  amountMinor: bigint;
}

export interface BalanceSheetCheck {
  currency: string;
  assetsMinor: bigint;
  liabilitiesMinor: bigint;
  equityMinor: bigint;
  imbalanceMinor: bigint;
}

export interface IncomeStatementRow {
  section: string;
  lineCode: string;
  lineLabel: string;
  currency: string;
  amountMinor: bigint;
}

export interface IncomeStatementSummaryByCurrency {
  currency: string;
  revenueMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
}

export interface CashFlowRow {
  section: string;
  lineCode: string;
  lineLabel: string;
  currency: string;
  amountMinor: bigint;
}

export interface CashFlowSummaryByCurrency {
  currency: string;
  netCashFlowMinor: bigint;
}

export interface LiquidityRow {
  bookId: string;
  bookLabel: string;
  counterpartyId: string | null;
  counterpartyName: string | null;
  currency: string;
  ledgerBalanceMinor: bigint;
  availableMinor: bigint;
  reservedMinor: bigint;
  pendingMinor: bigint;
}

export interface FxRevaluationRow {
  bucket: "realized" | "unrealized";
  currency: string;
  revenueMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
}

export interface FxRevaluationSummaryByCurrency {
  currency: string;
  realizedNetMinor: bigint;
  unrealizedNetMinor: bigint;
  totalNetMinor: bigint;
}

export interface FeeRevenueRow {
  product: string;
  channel: string;
  counterpartyId: string | null;
  counterpartyName: string | null;
  currency: string;
  feeRevenueMinor: bigint;
  spreadRevenueMinor: bigint;
  providerFeeExpenseMinor: bigint;
  netMinor: bigint;
}

export interface FeeRevenueSummaryByCurrency {
  currency: string;
  feeRevenueMinor: bigint;
  spreadRevenueMinor: bigint;
  providerFeeExpenseMinor: bigint;
  netMinor: bigint;
}

export interface ClosePackageAdjustment {
  documentId: string;
  docType: string;
  docNo: string;
  occurredAt: Date;
  title: string;
}

export interface ClosePackageAuditEvent {
  id: string;
  eventType: string;
  actorId: string | null;
  createdAt: Date;
}

export interface ClosePackageResult {
  id: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  revision: number;
  state: "closed" | "superseded";
  checksum: string;
  generatedAt: Date;
  closeDocumentId: string;
  reopenDocumentId: string | null;
  trialBalanceSummaryByCurrency: TrialBalanceSummaryByCurrency[];
  incomeStatementSummaryByCurrency: IncomeStatementSummaryByCurrency[];
  cashFlowSummaryByCurrency: CashFlowSummaryByCurrency[];
  adjustments: ClosePackageAdjustment[];
  auditEvents: ClosePackageAuditEvent[];
  payload: Record<string, unknown>;
}

export interface LineMapping {
  lineCode: string;
  lineLabel: string;
  section: string;
  accountNo: string;
  signMultiplier: number;
}

export interface AccountingReportsContext {
  db: Database;
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
  keyByParts: (...parts: (string | null | undefined)[]) => string;
  computeAccountNetMovements: (
    postings: ScopedPosting[],
  ) => Map<string, { accountNo: string; currency: string; netMinor: bigint }>;
}
