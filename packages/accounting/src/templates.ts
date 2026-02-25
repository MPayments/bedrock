import { makePlanKey } from "@bedrock/kernel";
import { TransferCodes } from "@bedrock/kernel/constants";

import { ACCOUNT_NO, OPERATION_CODE, POSTING_CODE } from "./constants";

export const OPERATION_TRANSFER_TYPE = {
  CREATE: "create",
  POST_PENDING: "post_pending",
  VOID_PENDING: "void_pending",
} as const;

export type OperationTransferType =
  (typeof OPERATION_TRANSFER_TYPE)[keyof typeof OPERATION_TRANSFER_TYPE];

export interface PostingAnalytics {
  counterpartyId?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  operationalAccountId?: string | null;
  transferId?: string | null;
  quoteId?: string | null;
  feeBucket?: string | null;
}

export interface PendingConfig {
  timeoutSeconds: number;
  ref?: string | null;
}

export interface CreateOperationTransferLine {
  type: typeof OPERATION_TRANSFER_TYPE.CREATE;
  planRef: string;
  bookOrgId: string;
  debitAccountNo: string;
  creditAccountNo: string;
  postingCode: string;
  currency: string;
  amount: bigint;
  code?: number;
  pending?: PendingConfig;
  chain?: string | null;
  memo?: string | null;
  analytics?: PostingAnalytics;
}

export interface PostPendingOperationTransferLine {
  type: typeof OPERATION_TRANSFER_TYPE.POST_PENDING;
  planRef: string;
  currency: string;
  pendingId: bigint;
  amount?: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export interface VoidPendingOperationTransferLine {
  type: typeof OPERATION_TRANSFER_TYPE.VOID_PENDING;
  planRef: string;
  currency: string;
  pendingId: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export type OperationTransferLine =
  | CreateOperationTransferLine
  | PostPendingOperationTransferLine
  | VoidPendingOperationTransferLine;

export interface TransferPostingBinding {
  accountId: string;
  counterpartyId: string;
  bookOrgId: string;
  bookAccountNo: string;
  currencyCode: string;
}

export interface TransferApproveTemplateInput {
  transferId: string;
  kind: "intra_org" | "cross_org";
  settlementMode: "immediate" | "pending";
  amountMinor: bigint;
  timeoutSeconds: number;
  memo?: string | null;
  source: TransferPostingBinding;
  destination: TransferPostingBinding;
}

export interface TransferPendingActionTemplateInput {
  transferId: string;
  eventIdempotencyKey: string;
  eventType: "settle" | "void";
  currency: string;
  pendingIds: bigint[];
}

export interface TransferApproveTemplateResult {
  operationCode:
    | typeof OPERATION_CODE.TRANSFER_APPROVE_IMMEDIATE_INTRA
    | typeof OPERATION_CODE.TRANSFER_APPROVE_PENDING_INTRA
    | typeof OPERATION_CODE.TRANSFER_APPROVE_IMMEDIATE_CROSS
    | typeof OPERATION_CODE.TRANSFER_APPROVE_PENDING_CROSS;
  transfers: OperationTransferLine[];
  sourcePendingRef: string;
  destinationPendingRef: string | null;
}

export interface TransferPendingActionTemplateResult {
  operationCode:
    | typeof OPERATION_CODE.TRANSFER_SETTLE_PENDING
    | typeof OPERATION_CODE.TRANSFER_VOID_PENDING;
  transfers: OperationTransferLine[];
}

export interface FeePostingTemplate {
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  transferCode: number;
  feeBucket?: string;
}

export function buildTransferApproveTemplate(
  input: TransferApproveTemplateInput,
): TransferApproveTemplateResult {
  const sourcePendingRef = `transfer:${input.transferId}:source`;
  const destinationPendingRef = `transfer:${input.transferId}:destination`;

  if (input.kind === "intra_org") {
    return {
      operationCode:
        input.settlementMode === "pending"
          ? OPERATION_CODE.TRANSFER_APPROVE_PENDING_INTRA
          : OPERATION_CODE.TRANSFER_APPROVE_IMMEDIATE_INTRA,
      sourcePendingRef,
      destinationPendingRef: null,
      transfers: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planRef: makePlanKey("transfer_v3_approve_intra", {
            transferId: input.transferId,
            sourceAccountId: input.source.accountId,
            destinationAccountId: input.destination.accountId,
            amount: input.amountMinor.toString(),
            currency: input.source.currencyCode,
            settlementMode: input.settlementMode,
          }),
          bookOrgId: input.source.bookOrgId,
          postingCode:
            input.settlementMode === "pending"
              ? POSTING_CODE.TRANSFER_INTRA_PENDING
              : POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
          debitAccountNo: input.destination.bookAccountNo,
          creditAccountNo: input.source.bookAccountNo,
          currency: input.source.currencyCode,
          amount: input.amountMinor,
          code: TransferCodes.INTERNAL_TRANSFER,
          pending:
            input.settlementMode === "pending"
              ? {
                  timeoutSeconds: input.timeoutSeconds,
                  ref: sourcePendingRef,
                }
              : undefined,
          memo: input.memo ?? null,
          analytics: {
            transferId: input.transferId,
            operationalAccountId: input.source.accountId,
          },
        },
      ],
    };
  }

  return {
    operationCode:
      input.settlementMode === "pending"
        ? OPERATION_CODE.TRANSFER_APPROVE_PENDING_CROSS
        : OPERATION_CODE.TRANSFER_APPROVE_IMMEDIATE_CROSS,
    sourcePendingRef,
    destinationPendingRef,
    transfers: [
      {
        type: OPERATION_TRANSFER_TYPE.CREATE,
        planRef: makePlanKey("transfer_v3_approve_cross_source", {
          transferId: input.transferId,
          sourceAccountId: input.source.accountId,
          destinationAccountId: input.destination.accountId,
          amount: input.amountMinor.toString(),
          currency: input.source.currencyCode,
          settlementMode: input.settlementMode,
        }),
        bookOrgId: input.source.bookOrgId,
        postingCode:
          input.settlementMode === "pending"
            ? POSTING_CODE.TRANSFER_CROSS_SOURCE_PENDING
            : POSTING_CODE.TRANSFER_CROSS_SOURCE_IMMEDIATE,
        debitAccountNo: ACCOUNT_NO.INTERCOMPANY_NET,
        creditAccountNo: input.source.bookAccountNo,
        currency: input.source.currencyCode,
        amount: input.amountMinor,
        code: TransferCodes.INTERNAL_TRANSFER,
        pending:
          input.settlementMode === "pending"
            ? {
                timeoutSeconds: input.timeoutSeconds,
                ref: sourcePendingRef,
              }
            : undefined,
        memo: input.memo ?? null,
        analytics: {
          transferId: input.transferId,
          counterpartyId: input.destination.counterpartyId,
          operationalAccountId: input.source.accountId,
        },
      },
      {
        type: OPERATION_TRANSFER_TYPE.CREATE,
        planRef: makePlanKey("transfer_v3_approve_cross_destination", {
          transferId: input.transferId,
          sourceAccountId: input.source.accountId,
          destinationAccountId: input.destination.accountId,
          amount: input.amountMinor.toString(),
          currency: input.source.currencyCode,
          settlementMode: input.settlementMode,
        }),
        bookOrgId: input.destination.bookOrgId,
        postingCode:
          input.settlementMode === "pending"
            ? POSTING_CODE.TRANSFER_CROSS_DEST_PENDING
            : POSTING_CODE.TRANSFER_CROSS_DEST_IMMEDIATE,
        debitAccountNo: input.destination.bookAccountNo,
        creditAccountNo: ACCOUNT_NO.INTERCOMPANY_NET,
        currency: input.source.currencyCode,
        amount: input.amountMinor,
        code: TransferCodes.INTERNAL_TRANSFER,
        pending:
          input.settlementMode === "pending"
            ? {
                timeoutSeconds: input.timeoutSeconds,
                ref: destinationPendingRef,
              }
            : undefined,
        memo: input.memo ?? null,
        analytics: {
          transferId: input.transferId,
          counterpartyId: input.source.counterpartyId,
          operationalAccountId: input.destination.accountId,
        },
      },
    ],
  };
}

export function buildTransferPendingActionTemplate(
  input: TransferPendingActionTemplateInput,
): TransferPendingActionTemplateResult {
  const operationCode =
    input.eventType === "settle"
      ? OPERATION_CODE.TRANSFER_SETTLE_PENDING
      : OPERATION_CODE.TRANSFER_VOID_PENDING;

  const transfers = input.pendingIds.map((pendingId, idx) => {
    const planRef = makePlanKey(`transfer_v3_${input.eventType}_${idx + 1}`, {
      transferId: input.transferId,
      pendingId: pendingId.toString(),
      eventIdempotencyKey: input.eventIdempotencyKey,
    });

    if (input.eventType === "settle") {
      return {
        type: OPERATION_TRANSFER_TYPE.POST_PENDING,
        planRef,
        currency: input.currency,
        pendingId,
        amount: 0n,
      } satisfies PostPendingOperationTransferLine;
    }

    return {
      type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
      planRef,
      currency: input.currency,
      pendingId,
    } satisfies VoidPendingOperationTransferLine;
  });

  return {
    operationCode,
    transfers,
  };
}

export function resolveInLedgerFeePostingTemplate(kind: string): FeePostingTemplate {
  if (kind === "fx_spread") {
    return {
      postingCode: POSTING_CODE.SPREAD_REVENUE,
      debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
      creditAccountNo: ACCOUNT_NO.SPREAD_REVENUE,
      transferCode: TransferCodes.SPREAD_REVENUE,
      feeBucket: "spread",
    };
  }

  if (kind === "bank_fee") {
    return {
      postingCode: POSTING_CODE.BANK_FEE_REVENUE,
      debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
      creditAccountNo: ACCOUNT_NO.FEE_REVENUE,
      transferCode: TransferCodes.BANK_FEE_REVENUE,
      feeBucket: "bank",
    };
  }

  if (kind === "blockchain_fee") {
    return {
      postingCode: POSTING_CODE.BLOCKCHAIN_FEE_REVENUE,
      debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
      creditAccountNo: ACCOUNT_NO.FEE_REVENUE,
      transferCode: TransferCodes.BLOCKCHAIN_FEE_REVENUE,
      feeBucket: "blockchain",
    };
  }

  if (kind === "manual_fee") {
    return {
      postingCode: POSTING_CODE.ARBITRARY_FEE_REVENUE,
      debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
      creditAccountNo: ACCOUNT_NO.FEE_REVENUE,
      transferCode: TransferCodes.ARBITRARY_FEE_REVENUE,
      feeBucket: "manual",
    };
  }

  return {
    postingCode: POSTING_CODE.FEE_REVENUE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_REVENUE,
    transferCode: TransferCodes.FEE_REVENUE,
    feeBucket: kind,
  };
}

export function resolveFeeReservePostingTemplate(bucket: string): FeePostingTemplate {
  return {
    postingCode: POSTING_CODE.FEE_SEPARATE_PAYMENT_RESERVE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_CLEARING,
    transferCode: TransferCodes.FEE_SEPARATE_PAYMENT_RESERVE,
    feeBucket: bucket,
  };
}

export function resolveAdjustmentInLedgerPostingTemplate(
  effect: "increase_charge" | "decrease_charge",
  kind: string,
): FeePostingTemplate {
  if (effect === "decrease_charge") {
    return {
      postingCode: POSTING_CODE.ADJUSTMENT_REFUND,
      debitAccountNo: ACCOUNT_NO.ADJUSTMENT_EXPENSE,
      creditAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
      transferCode: TransferCodes.ADJUSTMENT_REFUND,
      feeBucket: `adjustment:${kind}`,
    };
  }

  return {
    postingCode: POSTING_CODE.ADJUSTMENT_CHARGE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.ADJUSTMENT_REVENUE,
    transferCode: TransferCodes.ADJUSTMENT_CHARGE,
    feeBucket: `adjustment:${kind}`,
  };
}

export function resolveAdjustmentReservePostingTemplate(
  effect: "increase_charge" | "decrease_charge",
  kind: string,
): FeePostingTemplate {
  if (effect === "decrease_charge") {
    return {
      postingCode: POSTING_CODE.FEE_SEPARATE_PAYMENT_RESERVE,
      debitAccountNo: ACCOUNT_NO.ADJUSTMENT_EXPENSE,
      creditAccountNo: ACCOUNT_NO.FEE_CLEARING,
      transferCode: TransferCodes.FEE_SEPARATE_PAYMENT_RESERVE,
      feeBucket: `adjustment:${kind}`,
    };
  }

  return {
    postingCode: POSTING_CODE.FEE_SEPARATE_PAYMENT_RESERVE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_CLEARING,
    transferCode: TransferCodes.FEE_SEPARATE_PAYMENT_RESERVE,
    feeBucket: `adjustment:${kind}`,
  };
}
