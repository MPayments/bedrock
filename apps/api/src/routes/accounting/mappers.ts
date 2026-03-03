import { minorToAmountString } from "../../common/amount";

type PostingLike = {
  bookId: string;
  bookName: string | null;
  amountMinor: bigint;
  currencyPrecision: number;
  createdAt: Date;
};

type FinancialRowLike = {
  currency: string;
  revenueMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
};

type CounterpartyBalanceLike = {
  counterpartyAccountId: string;
  currency: string;
  balanceMinor: bigint;
  precision: number;
};

type TbPlanLike = {
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
};

type OperationLike = {
  postingDate: Date;
  postedAt: Date | null;
  lastOutboxErrorAt: Date | null;
  createdAt: Date;
};

type MappedTbPlan<TPlan extends TbPlanLike> = Omit<
  TPlan,
  "transferId" | "debitTbAccountId" | "creditTbAccountId" | "amount" | "pendingId" | "createdAt"
> & {
  transferId: string;
  debitTbAccountId: string | null;
  creditTbAccountId: string | null;
  amount: string;
  pendingId: string | null;
  createdAt: string;
};

function mapTbPlanDto<TPlan extends TbPlanLike>(plan: TPlan): MappedTbPlan<TPlan> {
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

export function mapFinancialResultRowDto<TRow extends FinancialRowLike>(row: TRow) {
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

export function mapFinancialSummaryDto<TRow extends FinancialRowLike>(row: TRow) {
  return mapFinancialResultRowDto(row);
}

export function mapCounterpartyBalanceDto<TBalance extends CounterpartyBalanceLike>(
  balance: TBalance,
) {
  return {
    counterpartyAccountId: balance.counterpartyAccountId,
    currency: balance.currency,
    balance: minorToAmountString(balance.balanceMinor, {
      precision: balance.precision,
    }),
    precision: balance.precision,
  };
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
