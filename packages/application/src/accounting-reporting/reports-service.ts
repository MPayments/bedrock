import { and, eq, inArray, sql, type SQL } from "drizzle-orm";

import { schema as accountingSchema } from "@bedrock/core/accounting/schema";
import { schema as balancesSchema } from "@bedrock/core/balances/schema";
import {
  isInternalLedgerCounterparty,
  listInternalLedgerCounterparties,
} from "@bedrock/core/counterparties";
import { schema as counterpartiesSchema } from "@bedrock/core/counterparties/schema";
import { schema as documentsSchema } from "@bedrock/core/documents/schema";
import { schema as ledgerSchema } from "@bedrock/core/ledger/schema";
import { schema as organizationsSchema } from "@bedrock/core/organizations/schema";
import { schema as requisitesSchema } from "@bedrock/core/requisites/schema";
import { canonicalJson, sha256Hex } from "@bedrock/kernel";
import { ValidationError } from "@bedrock/kernel/errors";
import {
  paginateInMemory,
  resolveSortOrder,
  sortInMemory,
  type PaginatedList,
} from "@bedrock/kernel/pagination";

import type { AccountingReportingServiceDeps } from "./internal/context";
import {
  BalanceSheetQuerySchema,
  CashFlowQuerySchema,
  ClosePackageQuerySchema,
  FeeRevenueQuerySchema,
  FxRevaluationQuerySchema,
  GeneralLedgerQuerySchema,
  IncomeStatementQuerySchema,
  LiquidityQuerySchema,
  TrialBalanceQuerySchema,
  type BalanceSheetQuery,
  type CashFlowQuery,
  type ClosePackageQuery,
  type FeeRevenueQuery,
  type FxRevaluationQuery,
  type GeneralLedgerQuery,
  type IncomeStatementQuery,
  type LiquidityQuery,
  type ReportAttributionMode,
  type ReportScopeType,
  type TrialBalanceQuery,
} from "./reports-validation";
import { schema as reportingSchema } from "./schema";

const schema = {
  ...accountingSchema,
  ...counterpartiesSchema,
  ...documentsSchema,
  ...ledgerSchema,
  ...organizationsSchema,
  ...requisitesSchema,
  ...balancesSchema,
  ...reportingSchema,
};

type FinancialResultStatus = "pending" | "posted" | "failed";

export interface ReportScopeMeta {
  scopeType: ReportScopeType;
  requestedCounterpartyIds: string[];
  requestedGroupIds: string[];
  requestedBookIds: string[];
  resolvedCounterpartyIdsCount: number;
  attributionMode: ReportAttributionMode;
  hasUnattributedData: boolean;
}

interface ResolvedScope {
  scopeType: ReportScopeType;
  requestedCounterpartyIds: string[];
  requestedGroupIds: string[];
  requestedBookIds: string[];
  resolvedCounterpartyIds: string[];
  resolvedBookIds: string[];
}

interface ScopedPosting {
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
  counterpartyId: string;
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

interface LineMapping {
  lineCode: string;
  lineLabel: string;
  section: string;
  accountNo: string;
  signMultiplier: number;
}

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  if (typeof value === "string") {
    return BigInt(value);
  }

  return 0n;
}

function normalizeCurrency(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.trim().toUpperCase();
}

function normalizeMonthStart(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

function toJsonSafeValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, toJsonSafeValue(nested)]),
    );
  }

  return value;
}

function toDateValue(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(typeof value === "string" ? value : String(value));
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }

  return parsed;
}

function buildScopeMeta(input: {
  scope: ResolvedScope;
  attributionMode: ReportAttributionMode;
  hasUnattributedData: boolean;
}): ReportScopeMeta {
  return {
    scopeType: input.scope.scopeType,
    requestedCounterpartyIds: input.scope.requestedCounterpartyIds,
    requestedGroupIds: input.scope.requestedGroupIds,
    requestedBookIds: input.scope.requestedBookIds,
    resolvedCounterpartyIdsCount: input.scope.resolvedCounterpartyIds.length,
    attributionMode: input.attributionMode,
    hasUnattributedData: input.hasUnattributedData,
  };
}

function keyByParts(...parts: (string | null | undefined)[]): string {
  return parts.map((part) => part ?? "").join("::");
}

export function createAccountingReportsService(deps: {
  db: AccountingReportingServiceDeps["db"];
}) {
  const { db } = deps;

  async function listInternalLedgerCounterpartyIds(): Promise<string[]> {
    const rows = await listInternalLedgerCounterparties(db);
    return rows.map((row) => row.id);
  }

  async function resolveGroupMemberRows(
    groupIds: string[],
    includeDescendants: boolean,
  ): Promise<{ rootGroupId: string; counterpartyId: string }[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const uniqueGroupIds = Array.from(new Set(groupIds));
    const groupIdsSql = sql.join(
      uniqueGroupIds.map((id) => sql`${id}`),
      sql`, `,
    );

    if (!includeDescendants) {
      const result = await db.execute(sql`
        WITH selected_groups AS (
          SELECT g.id AS root_group_id
          FROM ${schema.counterpartyGroups} g
          WHERE g.id IN (${groupIdsSql})
        )
        SELECT DISTINCT
          sg.root_group_id,
          m.counterparty_id
        FROM selected_groups sg
        INNER JOIN ${schema.counterpartyGroupMemberships} m
          ON m.group_id = sg.root_group_id
      `);

      return ((result.rows ?? []) as {
        root_group_id: string;
        counterparty_id: string;
      }[]).map((row) => ({
        rootGroupId: row.root_group_id,
        counterpartyId: row.counterparty_id,
      }));
    }

    const result = await db.execute(sql`
      WITH RECURSIVE selected_groups AS (
        SELECT g.id AS root_group_id, g.id AS group_id
        FROM ${schema.counterpartyGroups} g
        WHERE g.id IN (${groupIdsSql})
      ),
      group_tree AS (
        SELECT root_group_id, group_id
        FROM selected_groups
        UNION ALL
        SELECT gt.root_group_id, child.id
        FROM group_tree gt
        INNER JOIN ${schema.counterpartyGroups} child
          ON child.parent_id = gt.group_id
      )
      SELECT DISTINCT
        gt.root_group_id,
        m.counterparty_id
      FROM group_tree gt
      INNER JOIN ${schema.counterpartyGroupMemberships} m
        ON m.group_id = gt.group_id
    `);

    return ((result.rows ?? []) as {
      root_group_id: string;
      counterparty_id: string;
    }[]).map((row) => ({
      rootGroupId: row.root_group_id,
      counterpartyId: row.counterparty_id,
    }));
  }

  async function resolveScope(input: {
    scopeType: ReportScopeType;
    counterpartyIds: string[];
    groupIds: string[];
    bookIds: string[];
    includeDescendants: boolean;
  }): Promise<ResolvedScope> {
    const requestedCounterpartyIds = Array.from(new Set(input.counterpartyIds));
    const requestedGroupIds = Array.from(new Set(input.groupIds));
    const requestedBookIds = Array.from(new Set(input.bookIds));

    if (input.scopeType === "all") {
      return {
        scopeType: input.scopeType,
        requestedCounterpartyIds,
        requestedGroupIds,
        requestedBookIds,
        resolvedCounterpartyIds: [],
        resolvedBookIds: [],
      };
    }

    if (input.scopeType === "counterparty") {
      return {
        scopeType: input.scopeType,
        requestedCounterpartyIds,
        requestedGroupIds,
        requestedBookIds,
        resolvedCounterpartyIds: requestedCounterpartyIds,
        resolvedBookIds: [],
      };
    }

    if (input.scopeType === "group") {
      const members = await resolveGroupMemberRows(
        requestedGroupIds,
        input.includeDescendants,
      );

      return {
        scopeType: input.scopeType,
        requestedCounterpartyIds,
        requestedGroupIds,
        requestedBookIds,
        resolvedCounterpartyIds: Array.from(
          new Set(members.map((row) => row.counterpartyId)),
        ),
        resolvedBookIds: [],
      };
    }

    const bookIds = requestedBookIds;
    const bookRows =
      bookIds.length === 0
        ? []
        : await db
            .select({
              id: schema.books.id,
              counterpartyId: schema.books.organizationId,
            })
            .from(schema.books)
            .where(inArray(schema.books.id, bookIds));

    const internalCounterpartyIdSet = new Set(
      await listInternalLedgerCounterpartyIds(),
    );
    const invalidBookIds = bookRows
      .filter(
        (row) =>
          !row.counterpartyId ||
          !internalCounterpartyIdSet.has(row.counterpartyId),
      )
      .map((row) => row.id);
    if (invalidBookIds.length > 0) {
      throw new ValidationError(
        `book scope can include only internal-ledger books: ${invalidBookIds.join(", ")}`,
      );
    }

    return {
      scopeType: input.scopeType,
      requestedCounterpartyIds,
      requestedGroupIds,
      requestedBookIds,
      resolvedCounterpartyIds: Array.from(
        new Set(
          bookRows
            .map((row) => row.counterpartyId)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
      resolvedBookIds: bookRows.map((row) => row.id),
    };
  }

  async function fetchCounterpartyNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({
        id: schema.counterparties.id,
        shortName: schema.counterparties.shortName,
      })
      .from(schema.counterparties)
      .where(inArray(schema.counterparties.id, ids));

    return new Map(rows.map((row) => [row.id, row.shortName]));
  }

  async function fetchAccountMeta(
    accountNos: string[],
  ): Promise<Map<string, { name: string; kind: string }>> {
    if (accountNos.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({
        accountNo: schema.chartTemplateAccounts.accountNo,
        name: schema.chartTemplateAccounts.name,
        kind: schema.chartTemplateAccounts.kind,
      })
      .from(schema.chartTemplateAccounts)
      .where(inArray(schema.chartTemplateAccounts.accountNo, accountNos));

    return new Map(rows.map((row) => [row.accountNo, { name: row.name, kind: row.kind }]));
  }

  async function fetchLineMappings(
    reportKind:
      | "balance_sheet"
      | "income_statement"
      | "cash_flow_direct"
      | "cash_flow_indirect"
      | "fx_revaluation"
      | "fee_revenue",
    asOf: Date,
  ): Promise<Map<string, LineMapping[]>> {
    const rows = await db
      .select({
        lineCode: schema.accountingReportLineMappings.lineCode,
        lineLabel: schema.accountingReportLineMappings.lineLabel,
        section: schema.accountingReportLineMappings.section,
        accountNo: schema.accountingReportLineMappings.accountNo,
        signMultiplier: schema.accountingReportLineMappings.signMultiplier,
      })
      .from(schema.accountingReportLineMappings)
      .where(
        and(
          eq(schema.accountingReportLineMappings.standard, "ifrs"),
          eq(schema.accountingReportLineMappings.reportKind, reportKind),
          sql`${schema.accountingReportLineMappings.effectiveFrom} <= ${asOf}`,
          sql`(${schema.accountingReportLineMappings.effectiveTo} IS NULL OR ${schema.accountingReportLineMappings.effectiveTo} > ${asOf})`,
        ),
      );

    const byAccount = new Map<string, LineMapping[]>();
    for (const row of rows) {
      const existing = byAccount.get(row.accountNo);
      const mapped = {
        lineCode: row.lineCode,
        lineLabel: row.lineLabel,
        section: row.section,
        accountNo: row.accountNo,
        signMultiplier: row.signMultiplier,
      };
      if (existing) {
        existing.push(mapped);
      } else {
        byAccount.set(row.accountNo, [mapped]);
      }
    }

    return byAccount;
  }

  async function fetchScopedPostings(input: {
    scope: ResolvedScope;
    attributionMode: ReportAttributionMode;
    statuses: FinancialResultStatus[];
    from?: Date;
    to?: Date;
    asOf?: Date;
    currency?: string;
    includeUnattributed: boolean;
  }): Promise<ScopedPosting[]> {
    if (
      (input.scope.scopeType === "counterparty" || input.scope.scopeType === "group") &&
      input.scope.resolvedCounterpartyIds.length === 0
    ) {
      return [];
    }

    if (input.scope.scopeType === "book" && input.scope.resolvedBookIds.length === 0) {
      return [];
    }

    const internalLedgerCounterpartyIds =
      input.attributionMode === "book_org"
        ? await listInternalLedgerCounterpartyIds()
        : [];
    const internalLedgerCounterpartyIdSet = new Set(internalLedgerCounterpartyIds);

    const analyticAttributionSql = sql`CASE
      WHEN debit_inst.dimensions->>'counterpartyId' IS NOT NULL
       AND credit_inst.dimensions->>'counterpartyId' IS NOT NULL
       AND debit_inst.dimensions->>'counterpartyId' <> credit_inst.dimensions->>'counterpartyId'
        THEN NULL
      ELSE COALESCE(
        debit_inst.dimensions->>'counterpartyId',
        credit_inst.dimensions->>'counterpartyId'
      )
    END`;

    const conditions: SQL[] = [
      sql`lo.status IN (${sql.join(
        input.statuses.map((status) => sql`${status}`),
        sql`, `,
      )})`,
    ];

    if (input.from) {
      conditions.push(sql`lo.posting_date >= ${input.from}`);
    }

    if (input.to) {
      conditions.push(sql`lo.posting_date <= ${input.to}`);
    }

    if (input.asOf) {
      conditions.push(sql`lo.posting_date <= ${input.asOf}`);
    }

    if (input.currency) {
      conditions.push(sql`p.currency = ${input.currency}`);
    }

    if (input.scope.scopeType === "book") {
      conditions.push(
        sql`p.book_id IN (${sql.join(
          input.scope.resolvedBookIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    } else if (
      input.scope.scopeType === "counterparty" ||
      input.scope.scopeType === "group"
    ) {
      if (input.attributionMode === "analytic_counterparty") {
        conditions.push(
          sql`${analyticAttributionSql} IN (${sql.join(
            input.scope.resolvedCounterpartyIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      } else {
        const bookScopedCounterpartyIds = input.scope.resolvedCounterpartyIds.filter((id) =>
          internalLedgerCounterpartyIdSet.has(id),
        );
        if (bookScopedCounterpartyIds.length === 0) {
          return [];
        }
        conditions.push(
          sql`b.organization_id IN (${sql.join(
            bookScopedCounterpartyIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      }
    }

    if (input.attributionMode === "book_org") {
      if (internalLedgerCounterpartyIds.length === 0) {
        return [];
      }
      conditions.push(
        sql`b.organization_id IN (${sql.join(
          internalLedgerCounterpartyIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    }

    if (input.attributionMode === "analytic_counterparty" && !input.includeUnattributed) {
      conditions.push(sql`${analyticAttributionSql} IS NOT NULL`);
    }

    const whereSql = conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`true`;

    const result = await db.execute(sql`
      SELECT
        p.operation_id,
        p.line_no,
        lo.posting_date,
        lo.status,
        p.book_id,
        b.name AS book_name,
        b.organization_id::text AS book_counterparty_id,
        p.currency,
        p.amount_minor,
        p.posting_code,
        debit_inst.account_no AS debit_account_no,
        credit_inst.account_no AS credit_account_no,
        ${analyticAttributionSql} AS analytic_counterparty_id,
        d.id::text AS document_id,
        d.doc_type AS document_type,
        COALESCE(d.payload->>'channel', lo.source_type) AS channel
      FROM ${schema.postings} p
      INNER JOIN ${schema.ledgerOperations} lo
        ON lo.id = p.operation_id
      INNER JOIN ${schema.bookAccountInstances} debit_inst
        ON debit_inst.id = p.debit_instance_id
      INNER JOIN ${schema.bookAccountInstances} credit_inst
        ON credit_inst.id = p.credit_instance_id
      LEFT JOIN ${schema.books} b
        ON b.id = p.book_id
      LEFT JOIN ${schema.documentOperations} dop
        ON dop.operation_id = lo.id
      LEFT JOIN ${schema.documents} d
        ON d.id = dop.document_id
      WHERE ${whereSql}
      ORDER BY lo.posting_date, p.operation_id, p.line_no
    `);

    const rows = (result.rows ?? []) as {
      operation_id: string;
      line_no: number;
      posting_date: Date;
      status: FinancialResultStatus;
      book_id: string;
      book_name: string | null;
      book_counterparty_id: string | null;
      currency: string;
      amount_minor: unknown;
      posting_code: string;
      debit_account_no: string;
      credit_account_no: string;
      analytic_counterparty_id: string | null;
      document_id: string | null;
      document_type: string | null;
      channel: string | null;
    }[];

    return rows.map((row) => ({
      operationId: row.operation_id,
      lineNo: row.line_no,
      postingDate: new Date(row.posting_date),
      status: row.status,
      bookId: row.book_id,
      bookLabel: row.book_name,
      bookCounterpartyId: row.book_counterparty_id,
      currency: row.currency,
      amountMinor: toBigInt(row.amount_minor),
      postingCode: row.posting_code,
      debitAccountNo: row.debit_account_no,
      creditAccountNo: row.credit_account_no,
      analyticCounterpartyId: row.analytic_counterparty_id,
      documentId: row.document_id,
      documentType: row.document_type,
      channel: row.channel,
    }));
  }

  async function listTrialBalance(
    input?: TrialBalanceQuery,
  ): Promise<PaginatedList<TrialBalanceRow> & {
    summaryByCurrency: TrialBalanceSummaryByCurrency[];
    scopeMeta: ReportScopeMeta;
  }> {
    const query = TrialBalanceQuerySchema.parse(input ?? {});
    const from = new Date(query.from);
    const to = new Date(query.to);
    const scope = await resolveScope({
      scopeType: query.scopeType,
      counterpartyIds: query.counterpartyId,
      groupIds: query.groupId,
      bookIds: query.bookId,
      includeDescendants: query.includeDescendants,
    });

    const postings = await fetchScopedPostings({
      scope,
      attributionMode: query.attributionMode,
      statuses: query.status as FinancialResultStatus[],
      to,
      currency: normalizeCurrency(query.currency),
      includeUnattributed: query.includeUnattributed,
    });

    const totals = new Map<
      string,
      {
        accountNo: string;
        currency: string;
        openingDebitMinor: bigint;
        openingCreditMinor: bigint;
        periodDebitMinor: bigint;
        periodCreditMinor: bigint;
      }
    >();

    for (const posting of postings) {
      const isOpening = posting.postingDate < from;
      const isPeriod = posting.postingDate >= from && posting.postingDate <= to;

      if (!isOpening && !isPeriod) {
        continue;
      }

      const debitKey = keyByParts(posting.debitAccountNo, posting.currency);
      const debitBucket = totals.get(debitKey) ?? {
        accountNo: posting.debitAccountNo,
        currency: posting.currency,
        openingDebitMinor: 0n,
        openingCreditMinor: 0n,
        periodDebitMinor: 0n,
        periodCreditMinor: 0n,
      };
      if (isOpening) {
        debitBucket.openingDebitMinor += posting.amountMinor;
      }
      if (isPeriod) {
        debitBucket.periodDebitMinor += posting.amountMinor;
      }
      totals.set(debitKey, debitBucket);

      const creditKey = keyByParts(posting.creditAccountNo, posting.currency);
      const creditBucket = totals.get(creditKey) ?? {
        accountNo: posting.creditAccountNo,
        currency: posting.currency,
        openingDebitMinor: 0n,
        openingCreditMinor: 0n,
        periodDebitMinor: 0n,
        periodCreditMinor: 0n,
      };
      if (isOpening) {
        creditBucket.openingCreditMinor += posting.amountMinor;
      }
      if (isPeriod) {
        creditBucket.periodCreditMinor += posting.amountMinor;
      }
      totals.set(creditKey, creditBucket);
    }

    const accountMeta = await fetchAccountMeta(
      Array.from(new Set(Array.from(totals.values()).map((row) => row.accountNo))),
    );

    const rows: TrialBalanceRow[] = Array.from(totals.values()).map((row) => {
      const closingNetMinor =
        row.openingDebitMinor -
        row.openingCreditMinor +
        row.periodDebitMinor -
        row.periodCreditMinor;

      return {
        accountNo: row.accountNo,
        accountName: accountMeta.get(row.accountNo)?.name ?? null,
        accountKind: accountMeta.get(row.accountNo)?.kind ?? null,
        currency: row.currency,
        openingDebitMinor: row.openingDebitMinor,
        openingCreditMinor: row.openingCreditMinor,
        periodDebitMinor: row.periodDebitMinor,
        periodCreditMinor: row.periodCreditMinor,
        closingDebitMinor: closingNetMinor >= 0n ? closingNetMinor : 0n,
        closingCreditMinor: closingNetMinor < 0n ? -closingNetMinor : 0n,
      };
    });

    const sortMap = {
      accountNo: (row: TrialBalanceRow) => row.accountNo,
      accountName: (row: TrialBalanceRow) => row.accountName ?? "",
      currency: (row: TrialBalanceRow) => row.currency,
      openingDebitMinor: (row: TrialBalanceRow) => row.openingDebitMinor,
      openingCreditMinor: (row: TrialBalanceRow) => row.openingCreditMinor,
      periodDebitMinor: (row: TrialBalanceRow) => row.periodDebitMinor,
      periodCreditMinor: (row: TrialBalanceRow) => row.periodCreditMinor,
      closingDebitMinor: (row: TrialBalanceRow) => row.closingDebitMinor,
      closingCreditMinor: (row: TrialBalanceRow) => row.closingCreditMinor,
    };

    const sortedRows = sortInMemory(rows, {
      sortBy: query.sortBy as keyof typeof sortMap,
      sortOrder: resolveSortOrder(query.sortOrder),
      sortMap,
    });
    const paginated = paginateInMemory(sortedRows, {
      limit: query.limit,
      offset: query.offset,
    });

    const summaryByCurrencyMap = new Map<string, TrialBalanceSummaryByCurrency>();
    for (const row of rows) {
      const existing = summaryByCurrencyMap.get(row.currency) ?? {
        currency: row.currency,
        openingDebitMinor: 0n,
        openingCreditMinor: 0n,
        periodDebitMinor: 0n,
        periodCreditMinor: 0n,
        closingDebitMinor: 0n,
        closingCreditMinor: 0n,
      };
      existing.openingDebitMinor += row.openingDebitMinor;
      existing.openingCreditMinor += row.openingCreditMinor;
      existing.periodDebitMinor += row.periodDebitMinor;
      existing.periodCreditMinor += row.periodCreditMinor;
      existing.closingDebitMinor += row.closingDebitMinor;
      existing.closingCreditMinor += row.closingCreditMinor;
      summaryByCurrencyMap.set(row.currency, existing);
    }

    return {
      ...paginated,
      summaryByCurrency: Array.from(summaryByCurrencyMap.values()).sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      scopeMeta: buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: postings.some((row) => row.analyticCounterpartyId === null),
      }),
    };
  }

  async function listGeneralLedger(
    input?: GeneralLedgerQuery,
  ): Promise<PaginatedList<GeneralLedgerEntry> & {
    openingBalances: GeneralLedgerBalance[];
    closingBalances: GeneralLedgerBalance[];
    scopeMeta: ReportScopeMeta;
  }> {
    const query = GeneralLedgerQuerySchema.parse(input ?? {});
    const from = new Date(query.from);
    const to = new Date(query.to);

    const scope = await resolveScope({
      scopeType: query.scopeType,
      counterpartyIds: query.counterpartyId,
      groupIds: query.groupId,
      bookIds: query.bookId,
      includeDescendants: query.includeDescendants,
    });

    const postings = await fetchScopedPostings({
      scope,
      attributionMode: query.attributionMode,
      statuses: query.status as FinancialResultStatus[],
      to,
      currency: normalizeCurrency(query.currency),
      includeUnattributed: query.includeUnattributed,
    });

    const accountSet = new Set(query.accountNo);
    const openingByKey = new Map<string, GeneralLedgerBalance>();

    const entrySeed: (GeneralLedgerEntry & { deltaMinor: bigint; sideOrder: number })[] = [];

    for (const posting of postings) {
      const attributionId =
        query.attributionMode === "analytic_counterparty"
          ? posting.analyticCounterpartyId
          : posting.bookCounterpartyId;

      if (accountSet.has(posting.debitAccountNo)) {
        const deltaMinor = posting.amountMinor;
        if (posting.postingDate < from) {
          const key = keyByParts(posting.debitAccountNo, posting.currency);
          const opening = openingByKey.get(key) ?? {
            accountNo: posting.debitAccountNo,
            currency: posting.currency,
            balanceMinor: 0n,
          };
          opening.balanceMinor += deltaMinor;
          openingByKey.set(key, opening);
        } else {
          entrySeed.push({
            operationId: posting.operationId,
            lineNo: posting.lineNo,
            postingDate: posting.postingDate,
            bookId: posting.bookId,
            bookLabel: posting.bookLabel ?? posting.bookId,
            accountNo: posting.debitAccountNo,
            currency: posting.currency,
            postingCode: posting.postingCode,
            counterpartyId: attributionId,
            debitMinor: posting.amountMinor,
            creditMinor: 0n,
            runningBalanceMinor: 0n,
            deltaMinor,
            sideOrder: 0,
          });
        }
      }

      if (accountSet.has(posting.creditAccountNo)) {
        const deltaMinor = -posting.amountMinor;
        if (posting.postingDate < from) {
          const key = keyByParts(posting.creditAccountNo, posting.currency);
          const opening = openingByKey.get(key) ?? {
            accountNo: posting.creditAccountNo,
            currency: posting.currency,
            balanceMinor: 0n,
          };
          opening.balanceMinor += deltaMinor;
          openingByKey.set(key, opening);
        } else {
          entrySeed.push({
            operationId: posting.operationId,
            lineNo: posting.lineNo,
            postingDate: posting.postingDate,
            bookId: posting.bookId,
            bookLabel: posting.bookLabel ?? posting.bookId,
            accountNo: posting.creditAccountNo,
            currency: posting.currency,
            postingCode: posting.postingCode,
            counterpartyId: attributionId,
            debitMinor: 0n,
            creditMinor: posting.amountMinor,
            runningBalanceMinor: 0n,
            deltaMinor,
            sideOrder: 1,
          });
        }
      }
    }

    const inPeriodEntries = entrySeed.filter(
      (entry) => entry.postingDate >= from && entry.postingDate <= to,
    );

    const sortMap = {
      postingDate: (row: (typeof inPeriodEntries)[number]) => row.postingDate,
      operationId: (row: (typeof inPeriodEntries)[number]) => row.operationId,
      lineNo: (row: (typeof inPeriodEntries)[number]) => row.lineNo,
    };

    const sortedSeed = sortInMemory(inPeriodEntries, {
      sortBy: query.sortBy as keyof typeof sortMap,
      sortOrder: resolveSortOrder(query.sortOrder),
      sortMap,
    }).sort((left, right) => {
      if (left.operationId !== right.operationId) {
        return left.operationId.localeCompare(right.operationId);
      }

      if (left.lineNo !== right.lineNo) {
        return left.lineNo - right.lineNo;
      }

      return left.sideOrder - right.sideOrder;
    });

    const runningByKey = new Map<string, bigint>(
      Array.from(openingByKey.values()).map((row) => [
        keyByParts(row.accountNo, row.currency),
        row.balanceMinor,
      ]),
    );

    const entries: GeneralLedgerEntry[] = sortedSeed.map((entry) => {
      const key = keyByParts(entry.accountNo, entry.currency);
      const running = (runningByKey.get(key) ?? 0n) + entry.deltaMinor;
      runningByKey.set(key, running);

      return {
        operationId: entry.operationId,
        lineNo: entry.lineNo,
        postingDate: entry.postingDate,
        bookId: entry.bookId,
        bookLabel: entry.bookLabel,
        accountNo: entry.accountNo,
        currency: entry.currency,
        postingCode: entry.postingCode,
        counterpartyId: entry.counterpartyId,
        debitMinor: entry.debitMinor,
        creditMinor: entry.creditMinor,
        runningBalanceMinor: running,
      };
    });

    const paginated = paginateInMemory(entries, {
      limit: query.limit,
      offset: query.offset,
    });

    const openingBalances = Array.from(openingByKey.values()).sort((a, b) =>
      keyByParts(a.accountNo, a.currency).localeCompare(keyByParts(b.accountNo, b.currency)),
    );

    const closingBalances = Array.from(runningByKey.entries())
      .map(([key, balanceMinor]) => {
        const [accountNo = "", currency = ""] = key.split("::");
        return {
          accountNo,
          currency,
          balanceMinor,
        };
      })
      .sort((a, b) =>
        keyByParts(a.accountNo, a.currency).localeCompare(keyByParts(b.accountNo, b.currency)),
      );

    return {
      ...paginated,
      openingBalances,
      closingBalances,
      scopeMeta: buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: postings.some((row) => row.analyticCounterpartyId === null),
      }),
    };
  }

  async function listBalanceSheet(
    input?: BalanceSheetQuery,
  ): Promise<{
    data: BalanceSheetRow[];
    checks: BalanceSheetCheck[];
    scopeMeta: ReportScopeMeta;
  }> {
    const query = BalanceSheetQuerySchema.parse(input ?? {});
    const asOf = new Date(query.asOf);

    const scope = await resolveScope({
      scopeType: query.scopeType,
      counterpartyIds: query.counterpartyId,
      groupIds: query.groupId,
      bookIds: query.bookId,
      includeDescendants: query.includeDescendants,
    });

    const postings = await fetchScopedPostings({
      scope,
      attributionMode: query.attributionMode,
      statuses: query.status as FinancialResultStatus[],
      asOf,
      currency: normalizeCurrency(query.currency),
      includeUnattributed: query.includeUnattributed,
    });

    const netByAccountCurrency = new Map<string, { accountNo: string; currency: string; netMinor: bigint }>();

    for (const posting of postings) {
      const debitKey = keyByParts(posting.debitAccountNo, posting.currency);
      const debit = netByAccountCurrency.get(debitKey) ?? {
        accountNo: posting.debitAccountNo,
        currency: posting.currency,
        netMinor: 0n,
      };
      debit.netMinor += posting.amountMinor;
      netByAccountCurrency.set(debitKey, debit);

      const creditKey = keyByParts(posting.creditAccountNo, posting.currency);
      const credit = netByAccountCurrency.get(creditKey) ?? {
        accountNo: posting.creditAccountNo,
        currency: posting.currency,
        netMinor: 0n,
      };
      credit.netMinor -= posting.amountMinor;
      netByAccountCurrency.set(creditKey, credit);
    }

    const accountMeta = await fetchAccountMeta(
      Array.from(new Set(Array.from(netByAccountCurrency.values()).map((row) => row.accountNo))),
    );
    const lineMappings = await fetchLineMappings("balance_sheet", asOf);

    const rowsByLine = new Map<string, BalanceSheetRow>();

    for (const row of netByAccountCurrency.values()) {
      const meta = accountMeta.get(row.accountNo);
      const kind = meta?.kind;

      if (!kind) {
        continue;
      }

      let presentedMinor = row.netMinor;
      if (kind === "liability" || kind === "equity") {
        presentedMinor = -presentedMinor;
      }

      const mappings = lineMappings.get(row.accountNo) ?? [
        {
          lineCode: row.accountNo,
          lineLabel: meta.name,
          section:
            kind === "liability"
              ? "liabilities"
              : kind === "equity"
                ? "equity"
                : "assets",
          accountNo: row.accountNo,
          signMultiplier: 1,
        },
      ];

      for (const mapping of mappings) {
        const key = keyByParts(mapping.section, mapping.lineCode, row.currency);
        const existing = rowsByLine.get(key) ?? {
          section: mapping.section,
          lineCode: mapping.lineCode,
          lineLabel: mapping.lineLabel,
          currency: row.currency,
          amountMinor: 0n,
        };
        existing.amountMinor += presentedMinor * BigInt(mapping.signMultiplier);
        rowsByLine.set(key, existing);
      }
    }

    const rows = Array.from(rowsByLine.values()).sort((a, b) =>
      keyByParts(a.section, a.lineCode, a.currency).localeCompare(
        keyByParts(b.section, b.lineCode, b.currency),
      ),
    );

    const checksByCurrency = new Map<
      string,
      { assetsMinor: bigint; liabilitiesMinor: bigint; equityMinor: bigint }
    >();
    for (const row of rows) {
      const existing = checksByCurrency.get(row.currency) ?? {
        assetsMinor: 0n,
        liabilitiesMinor: 0n,
        equityMinor: 0n,
      };

      if (row.section === "assets") {
        existing.assetsMinor += row.amountMinor;
      } else if (row.section === "liabilities") {
        existing.liabilitiesMinor += row.amountMinor;
      } else if (row.section === "equity") {
        existing.equityMinor += row.amountMinor;
      }

      checksByCurrency.set(row.currency, existing);
    }

    const checks: BalanceSheetCheck[] = Array.from(checksByCurrency.entries())
      .map(([currency, value]) => ({
        currency,
        assetsMinor: value.assetsMinor,
        liabilitiesMinor: value.liabilitiesMinor,
        equityMinor: value.equityMinor,
        imbalanceMinor: value.assetsMinor - (value.liabilitiesMinor + value.equityMinor),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

    return {
      data: rows,
      checks,
      scopeMeta: buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: postings.some((item) => item.analyticCounterpartyId === null),
      }),
    };
  }

  async function computeIncomeStatementCore(input: {
    query: IncomeStatementQuery;
  }): Promise<{
    rows: IncomeStatementRow[];
    summaryByCurrency: IncomeStatementSummaryByCurrency[];
    scopeMeta: ReportScopeMeta;
    postings: ScopedPosting[];
  }> {
    const query = input.query;
    const from = new Date(query.from);
    const to = new Date(query.to);

    const scope = await resolveScope({
      scopeType: query.scopeType,
      counterpartyIds: query.counterpartyId,
      groupIds: query.groupId,
      bookIds: query.bookId,
      includeDescendants: query.includeDescendants,
    });

    const postings = await fetchScopedPostings({
      scope,
      attributionMode: query.attributionMode,
      statuses: query.status as FinancialResultStatus[],
      from,
      to,
      currency: normalizeCurrency(query.currency),
      includeUnattributed: query.includeUnattributed,
    });

    const accountSet = new Set<string>();
    for (const posting of postings) {
      accountSet.add(posting.debitAccountNo);
      accountSet.add(posting.creditAccountNo);
    }

    const accountMeta = await fetchAccountMeta(Array.from(accountSet));
    const mappings = await fetchLineMappings("income_statement", to);

    const amountByAccountCurrency = new Map<
      string,
      { accountNo: string; currency: string; amountMinor: bigint; kind: string }
    >();

    for (const posting of postings) {
      const debitKind = accountMeta.get(posting.debitAccountNo)?.kind;
      const creditKind = accountMeta.get(posting.creditAccountNo)?.kind;

      if (debitKind === "revenue" || debitKind === "expense") {
        const key = keyByParts(posting.debitAccountNo, posting.currency);
        const current = amountByAccountCurrency.get(key) ?? {
          accountNo: posting.debitAccountNo,
          currency: posting.currency,
          amountMinor: 0n,
          kind: debitKind,
        };
        if (debitKind === "revenue") {
          current.amountMinor -= posting.amountMinor;
        } else {
          current.amountMinor += posting.amountMinor;
        }
        amountByAccountCurrency.set(key, current);
      }

      if (creditKind === "revenue" || creditKind === "expense") {
        const key = keyByParts(posting.creditAccountNo, posting.currency);
        const current = amountByAccountCurrency.get(key) ?? {
          accountNo: posting.creditAccountNo,
          currency: posting.currency,
          amountMinor: 0n,
          kind: creditKind,
        };
        if (creditKind === "revenue") {
          current.amountMinor += posting.amountMinor;
        } else {
          current.amountMinor -= posting.amountMinor;
        }
        amountByAccountCurrency.set(key, current);
      }
    }

    const rowsByLine = new Map<string, IncomeStatementRow>();
    const summaryByCurrencyMap = new Map<string, IncomeStatementSummaryByCurrency>();

    for (const row of amountByAccountCurrency.values()) {
      const defaults = mappings.get(row.accountNo) ?? [
        {
          lineCode: row.accountNo,
          lineLabel: accountMeta.get(row.accountNo)?.name ?? row.accountNo,
          section: row.kind === "revenue" ? "revenue" : "expense",
          accountNo: row.accountNo,
          signMultiplier: 1,
        },
      ];

      for (const mapping of defaults) {
        const key = keyByParts(mapping.section, mapping.lineCode, row.currency);
        const existing = rowsByLine.get(key) ?? {
          section: mapping.section,
          lineCode: mapping.lineCode,
          lineLabel: mapping.lineLabel,
          currency: row.currency,
          amountMinor: 0n,
        };
        existing.amountMinor += row.amountMinor * BigInt(mapping.signMultiplier);
        rowsByLine.set(key, existing);
      }

      const summary = summaryByCurrencyMap.get(row.currency) ?? {
        currency: row.currency,
        revenueMinor: 0n,
        expenseMinor: 0n,
        netMinor: 0n,
      };
      if (row.kind === "revenue") {
        summary.revenueMinor += row.amountMinor;
      } else {
        summary.expenseMinor += row.amountMinor;
      }
      summary.netMinor = summary.revenueMinor - summary.expenseMinor;
      summaryByCurrencyMap.set(row.currency, summary);
    }

    return {
      rows: Array.from(rowsByLine.values()).sort((a, b) =>
        keyByParts(a.section, a.lineCode, a.currency).localeCompare(
          keyByParts(b.section, b.lineCode, b.currency),
        ),
      ),
      summaryByCurrency: Array.from(summaryByCurrencyMap.values()).sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      scopeMeta: buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: postings.some((item) => item.analyticCounterpartyId === null),
      }),
      postings,
    };
  }

  async function listIncomeStatement(
    input?: IncomeStatementQuery,
  ): Promise<{
    data: IncomeStatementRow[];
    summaryByCurrency: IncomeStatementSummaryByCurrency[];
    scopeMeta: ReportScopeMeta;
  }> {
    const query = IncomeStatementQuerySchema.parse(input ?? {});
    const result = await computeIncomeStatementCore({ query });

    return {
      data: result.rows,
      summaryByCurrency: result.summaryByCurrency,
      scopeMeta: result.scopeMeta,
    };
  }

  function computeAccountNetMovements(
    postings: ScopedPosting[],
  ): Map<string, { accountNo: string; currency: string; netMinor: bigint }> {
    const movements = new Map<string, { accountNo: string; currency: string; netMinor: bigint }>();

    for (const posting of postings) {
      const debitKey = keyByParts(posting.debitAccountNo, posting.currency);
      const debit = movements.get(debitKey) ?? {
        accountNo: posting.debitAccountNo,
        currency: posting.currency,
        netMinor: 0n,
      };
      debit.netMinor += posting.amountMinor;
      movements.set(debitKey, debit);

      const creditKey = keyByParts(posting.creditAccountNo, posting.currency);
      const credit = movements.get(creditKey) ?? {
        accountNo: posting.creditAccountNo,
        currency: posting.currency,
        netMinor: 0n,
      };
      credit.netMinor -= posting.amountMinor;
      movements.set(creditKey, credit);
    }

    return movements;
  }

  async function listCashFlow(
    input?: CashFlowQuery,
  ): Promise<{
    method: "direct" | "indirect";
    data: CashFlowRow[];
    summaryByCurrency: CashFlowSummaryByCurrency[];
    scopeMeta: ReportScopeMeta;
  }> {
    const query = CashFlowQuerySchema.parse(input ?? {});
    const from = new Date(query.from);
    const to = new Date(query.to);

    const scope = await resolveScope({
      scopeType: query.scopeType,
      counterpartyIds: query.counterpartyId,
      groupIds: query.groupId,
      bookIds: query.bookId,
      includeDescendants: query.includeDescendants,
    });

    const postings = await fetchScopedPostings({
      scope,
      attributionMode: query.attributionMode,
      statuses: query.status as FinancialResultStatus[],
      from,
      to,
      currency: normalizeCurrency(query.currency),
      includeUnattributed: query.includeUnattributed,
    });

    const movements = computeAccountNetMovements(postings);
    const reportKind = query.method === "direct" ? "cash_flow_direct" : "cash_flow_indirect";
    const mappings = await fetchLineMappings(reportKind, to);

    const rowsByLine = new Map<string, CashFlowRow>();
    const summaryByCurrency = new Map<string, CashFlowSummaryByCurrency>();

    if (query.method === "indirect") {
      const income = await computeIncomeStatementCore({
        query: {
          ...query,
          from: query.from,
          to: query.to,
        },
      });

      for (const summary of income.summaryByCurrency) {
        const key = keyByParts("indirect", "CFI.NET_PROFIT", summary.currency);
        rowsByLine.set(key, {
          section: "indirect",
          lineCode: "CFI.NET_PROFIT",
          lineLabel: "Net profit",
          currency: summary.currency,
          amountMinor: summary.netMinor,
        });

        summaryByCurrency.set(summary.currency, {
          currency: summary.currency,
          netCashFlowMinor: summary.netMinor,
        });
      }
    }

    for (const movement of movements.values()) {
      const targets = mappings.get(movement.accountNo) ?? [];
      if (targets.length === 0) {
        continue;
      }

      for (const mapping of targets) {
        const key = keyByParts(mapping.section, mapping.lineCode, movement.currency);
        const existing = rowsByLine.get(key) ?? {
          section: mapping.section,
          lineCode: mapping.lineCode,
          lineLabel: mapping.lineLabel,
          currency: movement.currency,
          amountMinor: 0n,
        };
        existing.amountMinor += movement.netMinor * BigInt(mapping.signMultiplier);
        rowsByLine.set(key, existing);

        const summary = summaryByCurrency.get(movement.currency) ?? {
          currency: movement.currency,
          netCashFlowMinor: 0n,
        };
        summary.netCashFlowMinor += movement.netMinor * BigInt(mapping.signMultiplier);
        summaryByCurrency.set(movement.currency, summary);
      }
    }

    return {
      method: query.method,
      data: Array.from(rowsByLine.values()).sort((a, b) =>
        keyByParts(a.section, a.lineCode, a.currency).localeCompare(
          keyByParts(b.section, b.lineCode, b.currency),
        ),
      ),
      summaryByCurrency: Array.from(summaryByCurrency.values()).sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      scopeMeta: buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: postings.some((item) => item.analyticCounterpartyId === null),
      }),
    };
  }

  async function listLiquidity(
    input?: LiquidityQuery,
  ): Promise<PaginatedList<LiquidityRow> & { scopeMeta: ReportScopeMeta }> {
    const query = LiquidityQuerySchema.parse(input ?? {});
    const limit = query.limit;
    const offset = query.offset;

    const scope = await resolveScope({
      scopeType: query.scopeType,
      counterpartyIds: query.counterpartyId,
      groupIds: query.groupId,
      bookIds: query.bookId,
      includeDescendants: query.includeDescendants,
    });

    if (
      (scope.scopeType === "counterparty" || scope.scopeType === "group") &&
      scope.resolvedCounterpartyIds.length === 0
    ) {
      return {
        data: [],
        total: 0,
        limit,
        offset,
        scopeMeta: buildScopeMeta({
          scope,
          attributionMode: query.attributionMode,
          hasUnattributedData: false,
        }),
      };
    }

    const conditions: SQL[] = [
      eq(schema.balancePositions.subjectType, "organization_requisite"),
    ];

    if (scope.scopeType === "book") {
      conditions.push(
        sql`${schema.balancePositions.bookId} IN (${sql.join(
          scope.resolvedBookIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    }

    if (scope.scopeType === "counterparty" || scope.scopeType === "group") {
      if (query.attributionMode === "book_org") {
        const internalCounterpartyIdSet = new Set(
          await listInternalLedgerCounterpartyIds(),
        );
        const bookScopedCounterpartyIds = scope.resolvedCounterpartyIds.filter((id) =>
          internalCounterpartyIdSet.has(id),
        );
        if (bookScopedCounterpartyIds.length === 0) {
          return {
            data: [],
            total: 0,
            limit,
            offset,
            scopeMeta: buildScopeMeta({
              scope,
              attributionMode: query.attributionMode,
              hasUnattributedData: false,
            }),
          };
        }
        conditions.push(
          sql`${schema.books.organizationId} IN (${sql.join(
            bookScopedCounterpartyIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      } else {
        conditions.push(
          sql`${
            schema.requisites.organizationId
          } IN (${sql.join(
            scope.resolvedCounterpartyIds.map((id) => sql`${id}`),
            sql`, `,
          )}) AND ${schema.requisites.ownerType} = 'organization'`,
        );
      }
    }

    if (scope.scopeType === "all" && query.attributionMode === "book_org") {
      const internalCounterpartyIds = await listInternalLedgerCounterpartyIds();
      if (internalCounterpartyIds.length === 0) {
        return {
          data: [],
          total: 0,
          limit,
          offset,
          scopeMeta: buildScopeMeta({
            scope,
            attributionMode: query.attributionMode,
            hasUnattributedData: false,
          }),
        };
      }
      conditions.push(
        sql`${schema.books.organizationId} IN (${sql.join(
          internalCounterpartyIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    }

    if (query.currency) {
      conditions.push(eq(schema.balancePositions.currency, normalizeCurrency(query.currency)!));
    }

    const whereSql = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        bookId: schema.balancePositions.bookId,
        bookLabel: schema.books.name,
        counterpartyId: schema.requisites.organizationId,
        counterpartyName: schema.organizations.shortName,
        currency: schema.balancePositions.currency,
        ledgerBalanceMinor:
          sql<string>`coalesce(sum(${schema.balancePositions.ledgerBalance}), 0)::text`,
        availableMinor:
          sql<string>`coalesce(sum(${schema.balancePositions.available}), 0)::text`,
        reservedMinor:
          sql<string>`coalesce(sum(${schema.balancePositions.reserved}), 0)::text`,
        pendingMinor:
          sql<string>`coalesce(sum(${schema.balancePositions.pending}), 0)::text`,
      })
      .from(schema.balancePositions)
      .leftJoin(
        schema.requisites,
        and(
          eq(schema.requisites.id, schema.balancePositions.subjectId),
          eq(schema.requisites.ownerType, "organization"),
        ),
      )
      .leftJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.requisites.organizationId),
      )
      .leftJoin(schema.books, eq(schema.books.id, schema.balancePositions.bookId))
      .where(whereSql)
      .groupBy(
        schema.balancePositions.bookId,
        schema.books.name,
        schema.requisites.organizationId,
        schema.organizations.shortName,
        schema.balancePositions.currency,
      );

    const mapped: LiquidityRow[] = rows.map((row) => ({
      bookId: row.bookId,
      bookLabel: row.bookLabel ?? row.bookId,
      counterpartyId: row.counterpartyId,
      counterpartyName: row.counterpartyName,
      currency: row.currency,
      ledgerBalanceMinor: toBigInt(row.ledgerBalanceMinor),
      availableMinor: toBigInt(row.availableMinor),
      reservedMinor: toBigInt(row.reservedMinor),
      pendingMinor: toBigInt(row.pendingMinor),
    }));

    const sorted = sortInMemory(mapped, {
      sortMap: {
        book: (row: LiquidityRow) => row.bookLabel,
      },
      sortBy: "book",
      sortOrder: "asc",
    });

    const paginated = paginateInMemory(sorted, {
      limit,
      offset,
    });

    return {
      ...paginated,
      scopeMeta: buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: false,
      }),
    };
  }

  async function listFxRevaluation(
    input?: FxRevaluationQuery,
  ): Promise<{
    data: FxRevaluationRow[];
    summaryByCurrency: FxRevaluationSummaryByCurrency[];
    scopeMeta: ReportScopeMeta;
  }> {
    const query = FxRevaluationQuerySchema.parse(input ?? {});
    const from = new Date(query.from);
    const to = new Date(query.to);

    const scope = await resolveScope({
      scopeType: query.scopeType,
      counterpartyIds: query.counterpartyId,
      groupIds: query.groupId,
      bookIds: query.bookId,
      includeDescendants: query.includeDescendants,
    });

    const postings = await fetchScopedPostings({
      scope,
      attributionMode: query.attributionMode,
      statuses: query.status as FinancialResultStatus[],
      from,
      to,
      currency: normalizeCurrency(query.currency),
      includeUnattributed: query.includeUnattributed,
    });

    const accountSet = Array.from(
      new Set(postings.flatMap((item) => [item.debitAccountNo, item.creditAccountNo])),
    );
    const accountMeta = await fetchAccountMeta(accountSet);

    const rowsByBucket = new Map<string, FxRevaluationRow>();

    for (const posting of postings) {
      const bucket: "realized" | "unrealized" =
        posting.documentType === "revaluation_adjustment" ? "unrealized" : "realized";
      const key = keyByParts(bucket, posting.currency);
      const current = rowsByBucket.get(key) ?? {
        bucket,
        currency: posting.currency,
        revenueMinor: 0n,
        expenseMinor: 0n,
        netMinor: 0n,
      };

      const debitKind = accountMeta.get(posting.debitAccountNo)?.kind;
      const creditKind = accountMeta.get(posting.creditAccountNo)?.kind;

      if (debitKind === "revenue") {
        current.revenueMinor -= posting.amountMinor;
      } else if (debitKind === "expense") {
        current.expenseMinor += posting.amountMinor;
      }

      if (creditKind === "revenue") {
        current.revenueMinor += posting.amountMinor;
      } else if (creditKind === "expense") {
        current.expenseMinor -= posting.amountMinor;
      }

      current.netMinor = current.revenueMinor - current.expenseMinor;
      rowsByBucket.set(key, current);
    }

    const rows = Array.from(rowsByBucket.values()).sort((a, b) =>
      keyByParts(a.currency, a.bucket).localeCompare(keyByParts(b.currency, b.bucket)),
    );

    const summaryMap = new Map<string, FxRevaluationSummaryByCurrency>();
    for (const row of rows) {
      const summary = summaryMap.get(row.currency) ?? {
        currency: row.currency,
        realizedNetMinor: 0n,
        unrealizedNetMinor: 0n,
        totalNetMinor: 0n,
      };

      if (row.bucket === "realized") {
        summary.realizedNetMinor += row.netMinor;
      } else {
        summary.unrealizedNetMinor += row.netMinor;
      }

      summary.totalNetMinor = summary.realizedNetMinor + summary.unrealizedNetMinor;
      summaryMap.set(row.currency, summary);
    }

    return {
      data: rows,
      summaryByCurrency: Array.from(summaryMap.values()).sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      scopeMeta: buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: postings.some((item) => item.analyticCounterpartyId === null),
      }),
    };
  }

  async function listFeeRevenue(
    input?: FeeRevenueQuery,
  ): Promise<PaginatedList<FeeRevenueRow> & {
    summaryByCurrency: FeeRevenueSummaryByCurrency[];
    scopeMeta: ReportScopeMeta;
  }> {
    const query = FeeRevenueQuerySchema.parse(input ?? {});
    const limit = query.limit;
    const offset = query.offset;
    const from = new Date(query.from);
    const to = new Date(query.to);

    const scope = await resolveScope({
      scopeType: query.scopeType,
      counterpartyIds: query.counterpartyId,
      groupIds: query.groupId,
      bookIds: query.bookId,
      includeDescendants: query.includeDescendants,
    });

    const postings = await fetchScopedPostings({
      scope,
      attributionMode: query.attributionMode,
      statuses: query.status as FinancialResultStatus[],
      from,
      to,
      currency: normalizeCurrency(query.currency),
      includeUnattributed: query.includeUnattributed,
    });

    const byDimension = new Map<string, FeeRevenueRow>();
    const counterpartyIds = new Set<string>();

    for (const posting of postings) {
      const counterpartyId =
        query.attributionMode === "analytic_counterparty"
          ? posting.analyticCounterpartyId
          : posting.bookCounterpartyId;

      if (!query.includeUnattributed && !counterpartyId) {
        continue;
      }

      if (counterpartyId) {
        counterpartyIds.add(counterpartyId);
      }

      const product = posting.documentType ?? "unknown";
      const channel = posting.channel ?? "unknown";
      const key = keyByParts(product, channel, counterpartyId, posting.currency);
      const row = byDimension.get(key) ?? {
        product,
        channel,
        counterpartyId,
        counterpartyName: null,
        currency: posting.currency,
        feeRevenueMinor: 0n,
        spreadRevenueMinor: 0n,
        providerFeeExpenseMinor: 0n,
        netMinor: 0n,
      };

      if (posting.debitAccountNo === "4110") {
        row.feeRevenueMinor -= posting.amountMinor;
      }
      if (posting.creditAccountNo === "4110") {
        row.feeRevenueMinor += posting.amountMinor;
      }

      if (posting.debitAccountNo === "4120") {
        row.spreadRevenueMinor -= posting.amountMinor;
      }
      if (posting.creditAccountNo === "4120") {
        row.spreadRevenueMinor += posting.amountMinor;
      }

      if (posting.debitAccountNo === "5120") {
        row.providerFeeExpenseMinor += posting.amountMinor;
      }
      if (posting.creditAccountNo === "5120") {
        row.providerFeeExpenseMinor -= posting.amountMinor;
      }

      row.netMinor = row.feeRevenueMinor + row.spreadRevenueMinor - row.providerFeeExpenseMinor;
      byDimension.set(key, row);
    }

    const counterpartyNames = await fetchCounterpartyNames(Array.from(counterpartyIds));

    const rows = Array.from(byDimension.values()).map((row) => ({
      ...row,
      counterpartyName: row.counterpartyId
        ? (counterpartyNames.get(row.counterpartyId) ?? null)
        : null,
    }));

    const sorted = sortInMemory(rows, {
      sortBy: "net",
      sortOrder: "desc",
      sortMap: {
        net: (row: FeeRevenueRow) => row.netMinor,
      },
    });

    const paginated = paginateInMemory(sorted, {
      limit,
      offset,
    });

    const summaryMap = new Map<string, FeeRevenueSummaryByCurrency>();
    for (const row of rows) {
      const summary = summaryMap.get(row.currency) ?? {
        currency: row.currency,
        feeRevenueMinor: 0n,
        spreadRevenueMinor: 0n,
        providerFeeExpenseMinor: 0n,
        netMinor: 0n,
      };

      summary.feeRevenueMinor += row.feeRevenueMinor;
      summary.spreadRevenueMinor += row.spreadRevenueMinor;
      summary.providerFeeExpenseMinor += row.providerFeeExpenseMinor;
      summary.netMinor += row.netMinor;
      summaryMap.set(row.currency, summary);
    }

    return {
      ...paginated,
      summaryByCurrency: Array.from(summaryMap.values()).sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      scopeMeta: buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: postings.some((item) => item.analyticCounterpartyId === null),
      }),
    };
  }

  async function listClosePackage(
    input?: ClosePackageQuery,
  ): Promise<ClosePackageResult> {
    const query = ClosePackageQuerySchema.parse(input ?? {});
    const periodStart = normalizeMonthStart(new Date(query.periodStart));

    const isInternalCounterparty = await isInternalLedgerCounterparty({
      db,
      counterpartyId: query.counterpartyId,
    });
    if (!isInternalCounterparty) {
      throw new ValidationError(
        `Close package is available only for internal ledger counterparties: ${query.counterpartyId}`,
      );
    }

    const existingRows = await db
      .select()
      .from(schema.accountingClosePackages)
      .where(
        and(
          eq(schema.accountingClosePackages.counterpartyId, query.counterpartyId),
          eq(schema.accountingClosePackages.periodStart, periodStart),
        ),
      )
      .orderBy(sql`${schema.accountingClosePackages.revision} DESC`)
      .limit(1);

    if (existingRows[0]) {
      const row = existingRows[0];
      const payload = row.payload as Record<string, unknown>;
      const trialBalanceSummaryByCurrency = Array.isArray(payload.trialBalanceSummaryByCurrency)
        ? payload.trialBalanceSummaryByCurrency.map((item) => {
            const value = item as Record<string, unknown>;
            return {
              currency: String(value.currency ?? ""),
              openingDebitMinor: toBigInt(value.openingDebitMinor),
              openingCreditMinor: toBigInt(value.openingCreditMinor),
              periodDebitMinor: toBigInt(value.periodDebitMinor),
              periodCreditMinor: toBigInt(value.periodCreditMinor),
              closingDebitMinor: toBigInt(value.closingDebitMinor),
              closingCreditMinor: toBigInt(value.closingCreditMinor),
            };
          })
        : [];
      const incomeStatementSummaryByCurrency = Array.isArray(
        payload.incomeStatementSummaryByCurrency,
      )
        ? payload.incomeStatementSummaryByCurrency.map((item) => {
            const value = item as Record<string, unknown>;
            return {
              currency: String(value.currency ?? ""),
              revenueMinor: toBigInt(value.revenueMinor),
              expenseMinor: toBigInt(value.expenseMinor),
              netMinor: toBigInt(value.netMinor),
            };
          })
        : [];
      const cashFlowSummaryByCurrency = Array.isArray(payload.cashFlowSummaryByCurrency)
        ? payload.cashFlowSummaryByCurrency.map((item) => {
            const value = item as Record<string, unknown>;
            return {
              currency: String(value.currency ?? ""),
              netCashFlowMinor: toBigInt(value.netCashFlowMinor),
            };
          })
        : [];
      const adjustments = Array.isArray(payload.adjustments)
        ? payload.adjustments.map((item) => {
            const value = item as Record<string, unknown>;
            return {
              documentId: String(value.documentId ?? ""),
              docType: String(value.docType ?? ""),
              docNo: String(value.docNo ?? ""),
              occurredAt: toDateValue(value.occurredAt),
              title: String(value.title ?? ""),
            };
          })
        : [];
      const auditEvents = Array.isArray(payload.auditEvents)
        ? payload.auditEvents.map((item) => {
            const value = item as Record<string, unknown>;
            return {
              id: String(value.id ?? ""),
              eventType: String(value.eventType ?? ""),
              actorId: value.actorId ? String(value.actorId) : null,
              createdAt: toDateValue(value.createdAt),
            };
          })
        : [];
      return {
        id: row.id,
        counterpartyId: row.counterpartyId,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        revision: row.revision,
        state: row.state,
        checksum: row.checksum,
        generatedAt: row.generatedAt,
        closeDocumentId: row.closeDocumentId,
        reopenDocumentId: row.reopenDocumentId,
        trialBalanceSummaryByCurrency,
        incomeStatementSummaryByCurrency,
        cashFlowSummaryByCurrency,
        adjustments,
        auditEvents,
        payload,
      };
    }

    const [lock] = await db
      .select({
        periodEnd: schema.accountingPeriodLocks.periodEnd,
        state: schema.accountingPeriodLocks.state,
        lockedByDocumentId: schema.accountingPeriodLocks.lockedByDocumentId,
      })
      .from(schema.accountingPeriodLocks)
      .where(
        and(
          eq(schema.accountingPeriodLocks.counterpartyId, query.counterpartyId),
          eq(schema.accountingPeriodLocks.periodStart, periodStart),
        ),
      )
      .limit(1);

    if (!lock) {
      throw new ValidationError(
        `No period lock found for counterparty ${query.counterpartyId} and period ${periodStart.toISOString()}`,
      );
    }

    const periodEnd = lock.periodEnd;

    const trialBalance = await listTrialBalance({
      scopeType: "counterparty",
      counterpartyId: [query.counterpartyId],
      groupId: [],
      bookId: [],
      includeDescendants: true,
      attributionMode: "analytic_counterparty",
      includeUnattributed: false,
      currency: undefined,
      status: ["posted"],
      from: periodStart.toISOString(),
      to: periodEnd.toISOString(),
      limit: 200,
      offset: 0,
      sortBy: "accountNo",
      sortOrder: "asc",
    });

    const income = await listIncomeStatement({
      scopeType: "counterparty",
      counterpartyId: [query.counterpartyId],
      groupId: [],
      bookId: [],
      includeDescendants: true,
      attributionMode: "analytic_counterparty",
      includeUnattributed: false,
      currency: undefined,
      status: ["posted"],
      from: periodStart.toISOString(),
      to: periodEnd.toISOString(),
    });

    const cashFlow = await listCashFlow({
      scopeType: "counterparty",
      counterpartyId: [query.counterpartyId],
      groupId: [],
      bookId: [],
      includeDescendants: true,
      attributionMode: "analytic_counterparty",
      includeUnattributed: false,
      currency: undefined,
      status: ["posted"],
      from: periodStart.toISOString(),
      to: periodEnd.toISOString(),
      method: "direct",
    });

    const adjustments = await db
      .select({
        documentId: schema.documents.id,
        docType: schema.documents.docType,
        docNo: schema.documents.docNo,
        occurredAt: schema.documents.occurredAt,
        title: schema.documents.title,
      })
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.counterpartyId, query.counterpartyId),
          sql`${schema.documents.occurredAt} >= ${periodStart}`,
          sql`${schema.documents.occurredAt} <= ${periodEnd}`,
          inArray(schema.documents.docType, [
            "accrual_adjustment",
            "revaluation_adjustment",
            "impairment_adjustment",
            "closing_reclass",
          ]),
        ),
      )
      .orderBy(schema.documents.occurredAt);

    const adjustmentIds = adjustments.map((row) => row.documentId);
    const auditEvents =
      adjustmentIds.length === 0
        ? []
        : await db
            .select({
              id: schema.documentEvents.id,
              eventType: schema.documentEvents.eventType,
              actorId: schema.documentEvents.actorId,
              createdAt: schema.documentEvents.createdAt,
            })
            .from(schema.documentEvents)
            .where(inArray(schema.documentEvents.documentId, adjustmentIds))
            .orderBy(schema.documentEvents.createdAt);

    const closeDocumentId = lock.lockedByDocumentId;
    if (!closeDocumentId) {
      throw new ValidationError(
        `Period lock for counterparty ${query.counterpartyId} does not reference close document`,
      );
    }

    const payload = toJsonSafeValue({
      trialBalanceSummaryByCurrency: trialBalance.summaryByCurrency,
      incomeStatementSummaryByCurrency: income.summaryByCurrency,
      cashFlowSummaryByCurrency: cashFlow.summaryByCurrency,
      adjustments,
      auditEvents,
    }) as Record<string, unknown>;

    const checksum = sha256Hex(canonicalJson(payload));

    const maxRevisionRows = await db
      .select({ maxRevision: sql<number>`coalesce(max(${schema.accountingClosePackages.revision}), 0)::int` })
      .from(schema.accountingClosePackages)
      .where(
        and(
          eq(schema.accountingClosePackages.counterpartyId, query.counterpartyId),
          eq(schema.accountingClosePackages.periodStart, periodStart),
        ),
      );
    const maxRevision = maxRevisionRows[0]?.maxRevision ?? 0;

    const [inserted] = await db
      .insert(schema.accountingClosePackages)
      .values({
        counterpartyId: query.counterpartyId,
        periodStart,
        periodEnd,
        revision: maxRevision + 1,
        state: lock.state === "reopened" ? "superseded" : "closed",
        closeDocumentId,
        reopenDocumentId: null,
        checksum,
        payload,
      })
      .returning();

    return {
      id: inserted!.id,
      counterpartyId: inserted!.counterpartyId,
      periodStart: inserted!.periodStart,
      periodEnd: inserted!.periodEnd,
      revision: inserted!.revision,
      state: inserted!.state,
      checksum: inserted!.checksum,
      generatedAt: inserted!.generatedAt,
      closeDocumentId: inserted!.closeDocumentId,
      reopenDocumentId: inserted!.reopenDocumentId,
      trialBalanceSummaryByCurrency: trialBalance.summaryByCurrency,
      incomeStatementSummaryByCurrency: income.summaryByCurrency,
      cashFlowSummaryByCurrency: cashFlow.summaryByCurrency,
      adjustments: adjustments.map((item) => ({
        documentId: item.documentId,
        docType: item.docType,
        docNo: item.docNo,
        occurredAt: item.occurredAt,
        title: item.title,
      })),
      auditEvents: auditEvents.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        actorId: event.actorId,
        createdAt: event.createdAt,
      })),
      payload,
    };
  }

  async function listFeeRevenueBreakdown(input?: FeeRevenueQuery) {
    return listFeeRevenue(input);
  }

  return {
    listTrialBalance,
    listGeneralLedger,
    listBalanceSheet,
    listIncomeStatement,
    listCashFlow,
    listLiquidity,
    listFxRevaluation,
    listFeeRevenue,
    listFeeRevenueBreakdown,
    listClosePackage,
  };
}
