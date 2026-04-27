import { minorToAmountString } from "@bedrock/shared/money";

interface PostingLike {
  bookId: string;
  bookName: string | null;
  amountMinor: bigint;
  currencyPrecision: number;
  createdAt: Date;
}

interface FinancialRowLike {
  currency: string;
  revenueMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
}

interface TbPlanLike {
  id: string;
  lineNo: number;
  type: "create" | "post_pending" | "void_pending";
  transferId: string | bigint;
  debitTbAccountId: string | bigint | null;
  creditTbAccountId: string | bigint | null;
  tbLedger: number;
  amount: string | bigint;
  code: number;
  pendingRef: string | null;
  pendingId: string | bigint | null;
  isLinked: boolean;
  isPending: boolean;
  timeoutSeconds: number;
  status: "pending" | "posted" | "failed";
  error: string | null;
  createdAt: Date;
}

interface OperationLike {
  postingDate: Date;
  postedAt: Date | null;
  lastOutboxErrorAt: Date | null;
  createdAt: Date;
}

interface ReportScopeMetaLike {
  scopeType: "all" | "counterparty" | "group" | "book";
  requestedCounterpartyIds: string[];
  requestedGroupIds: string[];
  requestedBookIds: string[];
  resolvedCounterpartyIdsCount: number;
  attributionMode: "analytic_counterparty" | "book_org";
  hasUnattributedData: boolean;
}

type MappedTbPlan<TPlan extends TbPlanLike> = Omit<
  TPlan,
  | "transferId"
  | "debitTbAccountId"
  | "creditTbAccountId"
  | "amount"
  | "pendingId"
  | "createdAt"
> & {
  transferId: string;
  debitTbAccountId: string | null;
  creditTbAccountId: string | null;
  amount: string;
  pendingId: string | null;
  createdAt: string;
};

function mapTbPlanDto<TPlan extends TbPlanLike>(
  plan: TPlan,
): MappedTbPlan<TPlan> {
  return {
    ...plan,
    transferId: plan.transferId.toString(),
    debitTbAccountId: plan.debitTbAccountId?.toString() ?? null,
    creditTbAccountId: plan.creditTbAccountId?.toString() ?? null,
    amount: plan.amount.toString(),
    pendingId: plan.pendingId?.toString() ?? null,
    createdAt: plan.createdAt.toISOString(),
  };
}

export function mapPostingDto<TPosting extends PostingLike>(posting: TPosting) {
  const { amountMinor, ...postingWithoutMinor } = posting;
  return {
    ...postingWithoutMinor,
    amount: minorToAmountString(amountMinor, {
      precision: posting.currencyPrecision,
    }),
    createdAt: posting.createdAt.toISOString(),
  };
}

export function mapFinancialResultRowDto<TRow extends FinancialRowLike>(
  row: TRow,
) {
  const { revenueMinor, expenseMinor, netMinor, ...restRow } = row;
  return {
    ...restRow,
    revenue: minorToAmountString(revenueMinor, {
      currency: row.currency,
    }),
    expense: minorToAmountString(expenseMinor, {
      currency: row.currency,
    }),
    net: minorToAmountString(netMinor, {
      currency: row.currency,
    }),
  };
}

export function mapFinancialSummaryDto<TRow extends FinancialRowLike>(
  row: TRow,
) {
  return mapFinancialResultRowDto(row);
}

export function mapOperationDetailsDto<
  TOperation extends OperationLike,
  TPosting extends PostingLike,
  TTbPlan extends TbPlanLike,
>(details: {
  operation: TOperation;
  postings: TPosting[];
  tbPlans: TTbPlan[];
  dimensionLabels: Record<string, string>;
}) {
  const bookLabels = Object.fromEntries(
    details.postings.map((posting) => [
      posting.bookId,
      posting.bookName ?? posting.bookId,
    ]),
  );

  return {
    operation: {
      ...details.operation,
      bookLabels,
      postingDate: details.operation.postingDate.toISOString(),
      postedAt: details.operation.postedAt?.toISOString() ?? null,
      lastOutboxErrorAt:
        details.operation.lastOutboxErrorAt?.toISOString() ?? null,
      createdAt: details.operation.createdAt.toISOString(),
    },
    postings: details.postings.map((posting) => mapPostingDto(posting)),
    tbPlans: details.tbPlans.map((tbPlan) => mapTbPlanDto(tbPlan)),
    dimensionLabels: details.dimensionLabels,
  };
}

function mapMinorByCurrency(value: bigint, currency: string) {
  return minorToAmountString(value, { currency });
}

function mapReportScopeMetaDto<TMeta extends ReportScopeMetaLike>(
  meta: TMeta,
) {
  return {
    scopeType: meta.scopeType,
    requestedCounterpartyIds: meta.requestedCounterpartyIds,
    requestedGroupIds: meta.requestedGroupIds,
    requestedBookIds: meta.requestedBookIds,
    resolvedCounterpartyIdsCount: meta.resolvedCounterpartyIdsCount,
    attributionMode: meta.attributionMode,
    hasUnattributedData: meta.hasUnattributedData,
  };
}

export function mapTrialBalanceDto(input: {
  data: {
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
  }[];
  total: number;
  limit: number;
  offset: number;
  summaryByCurrency: {
    currency: string;
    openingDebitMinor: bigint;
    openingCreditMinor: bigint;
    periodDebitMinor: bigint;
    periodCreditMinor: bigint;
    closingDebitMinor: bigint;
    closingCreditMinor: bigint;
  }[];
  scopeMeta: ReportScopeMetaLike;
}) {
  return {
    data: input.data.map((row) => ({
      accountNo: row.accountNo,
      accountName: row.accountName,
      accountKind: row.accountKind,
      currency: row.currency,
      openingDebit: mapMinorByCurrency(row.openingDebitMinor, row.currency),
      openingCredit: mapMinorByCurrency(row.openingCreditMinor, row.currency),
      periodDebit: mapMinorByCurrency(row.periodDebitMinor, row.currency),
      periodCredit: mapMinorByCurrency(row.periodCreditMinor, row.currency),
      closingDebit: mapMinorByCurrency(row.closingDebitMinor, row.currency),
      closingCredit: mapMinorByCurrency(row.closingCreditMinor, row.currency),
    })),
    total: input.total,
    limit: input.limit,
    offset: input.offset,
    summaryByCurrency: input.summaryByCurrency.map((row) => ({
      currency: row.currency,
      openingDebit: mapMinorByCurrency(row.openingDebitMinor, row.currency),
      openingCredit: mapMinorByCurrency(row.openingCreditMinor, row.currency),
      periodDebit: mapMinorByCurrency(row.periodDebitMinor, row.currency),
      periodCredit: mapMinorByCurrency(row.periodCreditMinor, row.currency),
      closingDebit: mapMinorByCurrency(row.closingDebitMinor, row.currency),
      closingCredit: mapMinorByCurrency(row.closingCreditMinor, row.currency),
    })),
    scopeMeta: mapReportScopeMetaDto(input.scopeMeta),
  };
}

export function mapGeneralLedgerDto(input: {
  data: {
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
  }[];
  total: number;
  limit: number;
  offset: number;
  openingBalances: {
    accountNo: string;
    currency: string;
    balanceMinor: bigint;
  }[];
  closingBalances: {
    accountNo: string;
    currency: string;
    balanceMinor: bigint;
  }[];
  scopeMeta: ReportScopeMetaLike;
}) {
  return {
    data: input.data.map((row) => ({
      operationId: row.operationId,
      lineNo: row.lineNo,
      postingDate: row.postingDate.toISOString(),
      bookId: row.bookId,
      bookLabel: row.bookLabel,
      accountNo: row.accountNo,
      currency: row.currency,
      postingCode: row.postingCode,
      counterpartyId: row.counterpartyId,
      debit: mapMinorByCurrency(row.debitMinor, row.currency),
      credit: mapMinorByCurrency(row.creditMinor, row.currency),
      runningBalance: mapMinorByCurrency(row.runningBalanceMinor, row.currency),
    })),
    total: input.total,
    limit: input.limit,
    offset: input.offset,
    openingBalances: input.openingBalances.map((row) => ({
      accountNo: row.accountNo,
      currency: row.currency,
      balance: mapMinorByCurrency(row.balanceMinor, row.currency),
    })),
    closingBalances: input.closingBalances.map((row) => ({
      accountNo: row.accountNo,
      currency: row.currency,
      balance: mapMinorByCurrency(row.balanceMinor, row.currency),
    })),
    scopeMeta: mapReportScopeMetaDto(input.scopeMeta),
  };
}

export function mapBalanceSheetDto(input: {
  data: {
    section: string;
    lineCode: string;
    lineLabel: string;
    currency: string;
    amountMinor: bigint;
  }[];
  checks: {
    currency: string;
    assetsMinor: bigint;
    liabilitiesMinor: bigint;
    equityMinor: bigint;
    imbalanceMinor: bigint;
  }[];
  scopeMeta: ReportScopeMetaLike;
}) {
  return {
    data: input.data.map((row) => ({
      section: row.section,
      lineCode: row.lineCode,
      lineLabel: row.lineLabel,
      currency: row.currency,
      amount: mapMinorByCurrency(row.amountMinor, row.currency),
    })),
    checks: input.checks.map((row) => ({
      currency: row.currency,
      assets: mapMinorByCurrency(row.assetsMinor, row.currency),
      liabilities: mapMinorByCurrency(row.liabilitiesMinor, row.currency),
      equity: mapMinorByCurrency(row.equityMinor, row.currency),
      imbalance: mapMinorByCurrency(row.imbalanceMinor, row.currency),
    })),
    scopeMeta: mapReportScopeMetaDto(input.scopeMeta),
  };
}

export function mapIncomeStatementDto(input: {
  data: {
    section: string;
    lineCode: string;
    lineLabel: string;
    currency: string;
    amountMinor: bigint;
  }[];
  summaryByCurrency: {
    currency: string;
    revenueMinor: bigint;
    expenseMinor: bigint;
    netMinor: bigint;
  }[];
  scopeMeta: ReportScopeMetaLike;
}) {
  return {
    data: input.data.map((row) => ({
      section: row.section,
      lineCode: row.lineCode,
      lineLabel: row.lineLabel,
      currency: row.currency,
      amount: mapMinorByCurrency(row.amountMinor, row.currency),
    })),
    summaryByCurrency: input.summaryByCurrency.map((row) => ({
      currency: row.currency,
      revenue: mapMinorByCurrency(row.revenueMinor, row.currency),
      expense: mapMinorByCurrency(row.expenseMinor, row.currency),
      net: mapMinorByCurrency(row.netMinor, row.currency),
    })),
    scopeMeta: mapReportScopeMetaDto(input.scopeMeta),
  };
}

export function mapCashFlowDto(input: {
  method: "direct" | "indirect";
  data: {
    section: string;
    lineCode: string;
    lineLabel: string;
    currency: string;
    amountMinor: bigint;
  }[];
  summaryByCurrency: { currency: string; netCashFlowMinor: bigint }[];
  scopeMeta: ReportScopeMetaLike;
}) {
  return {
    method: input.method,
    data: input.data.map((row) => ({
      section: row.section,
      lineCode: row.lineCode,
      lineLabel: row.lineLabel,
      currency: row.currency,
      amount: mapMinorByCurrency(row.amountMinor, row.currency),
    })),
    summaryByCurrency: input.summaryByCurrency.map((row) => ({
      currency: row.currency,
      netCashFlow: mapMinorByCurrency(row.netCashFlowMinor, row.currency),
    })),
    scopeMeta: mapReportScopeMetaDto(input.scopeMeta),
  };
}

export function mapLiquidityDto(input: {
  data: {
    bookId: string;
    bookLabel: string;
    counterpartyId: string | null;
    counterpartyName: string | null;
    currency: string;
    ledgerBalanceMinor: bigint;
    availableMinor: bigint;
    reservedMinor: bigint;
    pendingMinor: bigint;
  }[];
  total: number;
  limit: number;
  offset: number;
  scopeMeta: ReportScopeMetaLike;
}) {
  return {
    data: input.data.map((row) => ({
      bookId: row.bookId,
      bookLabel: row.bookLabel,
      counterpartyId: row.counterpartyId,
      counterpartyName: row.counterpartyName,
      currency: row.currency,
      ledgerBalance: mapMinorByCurrency(row.ledgerBalanceMinor, row.currency),
      available: mapMinorByCurrency(row.availableMinor, row.currency),
      reserved: mapMinorByCurrency(row.reservedMinor, row.currency),
      pending: mapMinorByCurrency(row.pendingMinor, row.currency),
    })),
    total: input.total,
    limit: input.limit,
    offset: input.offset,
    scopeMeta: mapReportScopeMetaDto(input.scopeMeta),
  };
}

export function mapFxRevaluationDto(input: {
  data: {
    bucket: "realized" | "unrealized";
    currency: string;
    revenueMinor: bigint;
    expenseMinor: bigint;
    netMinor: bigint;
  }[];
  summaryByCurrency: {
    currency: string;
    realizedNetMinor: bigint;
    unrealizedNetMinor: bigint;
    totalNetMinor: bigint;
  }[];
  scopeMeta: ReportScopeMetaLike;
}) {
  return {
    data: input.data.map((row) => ({
      bucket: row.bucket,
      currency: row.currency,
      revenue: mapMinorByCurrency(row.revenueMinor, row.currency),
      expense: mapMinorByCurrency(row.expenseMinor, row.currency),
      net: mapMinorByCurrency(row.netMinor, row.currency),
    })),
    summaryByCurrency: input.summaryByCurrency.map((row) => ({
      currency: row.currency,
      realizedNet: mapMinorByCurrency(row.realizedNetMinor, row.currency),
      unrealizedNet: mapMinorByCurrency(row.unrealizedNetMinor, row.currency),
      totalNet: mapMinorByCurrency(row.totalNetMinor, row.currency),
    })),
    scopeMeta: mapReportScopeMetaDto(input.scopeMeta),
  };
}

export function mapFeeRevenueDto(input: {
  data: {
    product: string;
    channel: string;
    counterpartyId: string | null;
    counterpartyName: string | null;
    currency: string;
    feeRevenueMinor: bigint;
    spreadRevenueMinor: bigint;
    providerFeeExpenseMinor: bigint;
    netMinor: bigint;
  }[];
  total: number;
  limit: number;
  offset: number;
  summaryByCurrency: {
    currency: string;
    feeRevenueMinor: bigint;
    spreadRevenueMinor: bigint;
    providerFeeExpenseMinor: bigint;
    netMinor: bigint;
  }[];
  scopeMeta: ReportScopeMetaLike;
}) {
  return {
    data: input.data.map((row) => ({
      product: row.product,
      channel: row.channel,
      counterpartyId: row.counterpartyId,
      counterpartyName: row.counterpartyName,
      currency: row.currency,
      feeRevenue: mapMinorByCurrency(row.feeRevenueMinor, row.currency),
      spreadRevenue: mapMinorByCurrency(row.spreadRevenueMinor, row.currency),
      providerFeeExpense: mapMinorByCurrency(
        row.providerFeeExpenseMinor,
        row.currency,
      ),
      net: mapMinorByCurrency(row.netMinor, row.currency),
    })),
    total: input.total,
    limit: input.limit,
    offset: input.offset,
    summaryByCurrency: input.summaryByCurrency.map((row) => ({
      currency: row.currency,
      feeRevenue: mapMinorByCurrency(row.feeRevenueMinor, row.currency),
      spreadRevenue: mapMinorByCurrency(row.spreadRevenueMinor, row.currency),
      providerFeeExpense: mapMinorByCurrency(
        row.providerFeeExpenseMinor,
        row.currency,
      ),
      net: mapMinorByCurrency(row.netMinor, row.currency),
    })),
    scopeMeta: mapReportScopeMetaDto(input.scopeMeta),
  };
}

export function mapClosePackageDto(input: {
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
  trialBalanceSummaryByCurrency: {
    currency: string;
    openingDebitMinor: bigint;
    openingCreditMinor: bigint;
    periodDebitMinor: bigint;
    periodCreditMinor: bigint;
    closingDebitMinor: bigint;
    closingCreditMinor: bigint;
  }[];
  incomeStatementSummaryByCurrency: {
    currency: string;
    revenueMinor: bigint;
    expenseMinor: bigint;
    netMinor: bigint;
  }[];
  cashFlowSummaryByCurrency: { currency: string; netCashFlowMinor: bigint }[];
  adjustments: {
    documentId: string;
    docType: string;
    docNo: string;
    occurredAt: Date;
    title: string;
  }[];
  auditEvents: {
    id: string;
    eventType: string;
    actorId: string | null;
    createdAt: Date;
  }[];
  payload: Record<string, unknown>;
}) {
  return {
    id: input.id,
    organizationId: input.organizationId,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    revision: input.revision,
    state: input.state,
    checksum: input.checksum,
    generatedAt: input.generatedAt.toISOString(),
    closeDocumentId: input.closeDocumentId,
    reopenDocumentId: input.reopenDocumentId,
    trialBalanceSummaryByCurrency: input.trialBalanceSummaryByCurrency.map(
      (row) => ({
        currency: row.currency,
        openingDebit: mapMinorByCurrency(row.openingDebitMinor, row.currency),
        openingCredit: mapMinorByCurrency(row.openingCreditMinor, row.currency),
        periodDebit: mapMinorByCurrency(row.periodDebitMinor, row.currency),
        periodCredit: mapMinorByCurrency(row.periodCreditMinor, row.currency),
        closingDebit: mapMinorByCurrency(row.closingDebitMinor, row.currency),
        closingCredit: mapMinorByCurrency(row.closingCreditMinor, row.currency),
      }),
    ),
    incomeStatementSummaryByCurrency:
      input.incomeStatementSummaryByCurrency.map((row) => ({
        currency: row.currency,
        revenue: mapMinorByCurrency(row.revenueMinor, row.currency),
        expense: mapMinorByCurrency(row.expenseMinor, row.currency),
        net: mapMinorByCurrency(row.netMinor, row.currency),
      })),
    cashFlowSummaryByCurrency: input.cashFlowSummaryByCurrency.map((row) => ({
      currency: row.currency,
      netCashFlow: mapMinorByCurrency(row.netCashFlowMinor, row.currency),
    })),
    adjustments: input.adjustments.map((row) => ({
      documentId: row.documentId,
      docType: row.docType,
      docNo: row.docNo,
      occurredAt: row.occurredAt.toISOString(),
      title: row.title,
    })),
    auditEvents: input.auditEvents.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      actorId: row.actorId,
      createdAt: row.createdAt.toISOString(),
    })),
    payload: input.payload,
  };
}
