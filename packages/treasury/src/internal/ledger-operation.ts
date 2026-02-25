import { ACCOUNT_NO, POSTING_CODE } from "@bedrock/accounting";
import { TransferCodes } from "@bedrock/kernel/constants";
import {
  PlanType,
  type CreateOperationInput,
  type TransferPlanLine,
} from "@bedrock/ledger";

type CreateTransferAnalytics = Extract<
  TransferPlanLine,
  { type: PlanType.CREATE }
>["analytics"];

interface KeyedCreateTransferPlan {
  type: PlanType.CREATE;
  planKey: string;
  debitKey: string;
  creditKey: string;
  currency: string;
  amount: bigint;
  code?: number;
  pending?: {
    timeoutSeconds: number;
    ref?: string | null;
  };
  chain?: string | null;
  memo?: string | null;
  analytics?: CreateTransferAnalytics;
}

interface KeyedPostPendingTransferPlan {
  type: PlanType.POST_PENDING;
  planKey: string;
  currency: string;
  pendingId: bigint;
  amount?: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

interface KeyedVoidPendingTransferPlan {
  type: PlanType.VOID_PENDING;
  planKey: string;
  currency: string;
  pendingId: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export type KeyedTransferPlan =
  | KeyedCreateTransferPlan
  | KeyedPostPendingTransferPlan
  | KeyedVoidPendingTransferPlan;

export interface BuildTreasuryOperationInput {
  source: CreateOperationInput["source"];
  operationCode: string;
  operationVersion?: number;
  payload?: unknown;
  idempotencyKey: string;
  postingDate: Date;
  bookOrgId: string;
  transfers: KeyedTransferPlan[];
}

const ACCOUNT_NO_PATTERN = /^[0-9]{2}(\.[0-9]{2})?$/;

function accountNoFromKey(key: string): string {
  const trimmed = key.trim();
  if (ACCOUNT_NO_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.toLowerCase();
  if (normalized.startsWith("customer:")) return ACCOUNT_NO.CUSTOMER_WALLET;
  if (normalized.startsWith("revenue:")) return ACCOUNT_NO.FEE_REVENUE;
  if (normalized.startsWith("expense:")) return ACCOUNT_NO.ADJUSTMENT_EXPENSE;
  if (normalized.startsWith("intermediate:")) return ACCOUNT_NO.TRANSIT;
  if (normalized.startsWith("liability:")) return ACCOUNT_NO.FEE_CLEARING;
  if (normalized.includes("customerwallet")) return ACCOUNT_NO.CUSTOMER_WALLET;
  if (normalized.includes("orderinventory")) return ACCOUNT_NO.ORDER_INVENTORY;
  if (normalized.includes("payoutobligation")) {
    return ACCOUNT_NO.PAYOUT_OBLIGATION;
  }
  if (normalized.includes("ic:branchnet")) return ACCOUNT_NO.INTERCOMPANY_NET;
  if (normalized.includes("liability:feeclearing")) {
    return ACCOUNT_NO.FEE_CLEARING;
  }
  if (normalized.includes("revenue:fxspread")) return ACCOUNT_NO.SPREAD_REVENUE;
  if (normalized.includes("revenue:adjustment")) {
    return ACCOUNT_NO.ADJUSTMENT_REVENUE;
  }
  if (normalized.includes("expense:adjustment")) {
    return ACCOUNT_NO.ADJUSTMENT_EXPENSE;
  }
  if (normalized.includes("revenue:fee")) return ACCOUNT_NO.FEE_REVENUE;
  if (normalized.includes("account:")) return ACCOUNT_NO.BANK;
  if (normalized.includes("bank:")) return ACCOUNT_NO.BANK;
  return ACCOUNT_NO.BANK;
}

function postingCodeFromTransferCode(
  code: number | undefined,
): (typeof POSTING_CODE)[keyof typeof POSTING_CODE] {
  switch (code) {
    case TransferCodes.FUNDING_SETTLED:
      return POSTING_CODE.FUNDING_SETTLED;
    case TransferCodes.FX_PRINCIPAL:
      return POSTING_CODE.FX_PRINCIPAL;
    case TransferCodes.FEE_REVENUE:
      return POSTING_CODE.FEE_REVENUE;
    case TransferCodes.SPREAD_REVENUE:
      return POSTING_CODE.SPREAD_REVENUE;
    case TransferCodes.FX_INTERCOMPANY_COMMIT:
      return POSTING_CODE.FX_INTERCOMPANY_COMMIT;
    case TransferCodes.FX_PAYOUT_OBLIGATION:
      return POSTING_CODE.FX_PAYOUT_OBLIGATION;
    case TransferCodes.BANK_FEE_REVENUE:
      return POSTING_CODE.BANK_FEE_REVENUE;
    case TransferCodes.BLOCKCHAIN_FEE_REVENUE:
      return POSTING_CODE.BLOCKCHAIN_FEE_REVENUE;
    case TransferCodes.ARBITRARY_FEE_REVENUE:
      return POSTING_CODE.ARBITRARY_FEE_REVENUE;
    case TransferCodes.FX_LEG_OUT:
      return POSTING_CODE.FX_LEG_OUT;
    case TransferCodes.FX_LEG_IN:
      return POSTING_CODE.FX_LEG_IN;
    case TransferCodes.PAYOUT_INITIATED:
      return POSTING_CODE.PAYOUT_INITIATED;
    case TransferCodes.FEE_SEPARATE_PAYMENT_RESERVE:
      return POSTING_CODE.FEE_SEPARATE_PAYMENT_RESERVE;
    case TransferCodes.FEE_PAYMENT_INITIATED:
      return POSTING_CODE.FEE_PAYMENT_INITIATED;
    case TransferCodes.FEE_PAYMENT_SETTLED:
      return POSTING_CODE.FEE_PAYMENT_SETTLED;
    case TransferCodes.FEE_PAYMENT_VOIDED:
      return POSTING_CODE.FEE_PAYMENT_VOIDED;
    case TransferCodes.ADJUSTMENT_CHARGE:
      return POSTING_CODE.ADJUSTMENT_CHARGE;
    case TransferCodes.ADJUSTMENT_REFUND:
      return POSTING_CODE.ADJUSTMENT_REFUND;
    case TransferCodes.INTERNAL_TRANSFER:
      return POSTING_CODE.INTERNAL_TRANSFER;
    default:
      return POSTING_CODE.INTERNAL_TRANSFER;
  }
}

function toTransferPlan(
  bookOrgId: string,
  transfer: KeyedTransferPlan,
): TransferPlanLine {
  if (transfer.type === PlanType.CREATE) {
    return {
      type: PlanType.CREATE,
      planRef: transfer.planKey,
      bookOrgId,
      postingCode: postingCodeFromTransferCode(transfer.code),
      debitAccountNo: accountNoFromKey(transfer.debitKey),
      creditAccountNo: accountNoFromKey(transfer.creditKey),
      currency: transfer.currency,
      amount: transfer.amount,
      code: transfer.code,
      pending: transfer.pending
        ? {
            timeoutSeconds: transfer.pending.timeoutSeconds,
            ref: transfer.pending.ref ?? transfer.planKey,
          }
        : undefined,
      chain: transfer.chain,
      memo: transfer.memo,
      analytics: transfer.analytics,
    };
  }

  if (transfer.type === PlanType.POST_PENDING) {
    return {
      type: PlanType.POST_PENDING,
      planRef: transfer.planKey,
      currency: transfer.currency,
      pendingId: transfer.pendingId,
      amount: transfer.amount,
      code: transfer.code,
      chain: transfer.chain,
      memo: transfer.memo,
    };
  }

  return {
    type: PlanType.VOID_PENDING,
    planRef: transfer.planKey,
    currency: transfer.currency,
    pendingId: transfer.pendingId,
    code: transfer.code,
    chain: transfer.chain,
    memo: transfer.memo,
  };
}

export function buildTreasuryOperationInput(
  input: BuildTreasuryOperationInput,
): CreateOperationInput {
  return {
    source: input.source,
    operationCode: input.operationCode,
    operationVersion: input.operationVersion ?? 1,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
    postingDate: input.postingDate,
    transfers: input.transfers.map((transfer) =>
      toTransferPlan(input.bookOrgId, transfer),
    ),
  };
}
