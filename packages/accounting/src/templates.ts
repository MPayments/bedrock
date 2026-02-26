import { makePlanKey } from "@bedrock/kernel";
import { TransferCodes } from "@bedrock/kernel/constants";

import { ACCOUNT_NO, CLEARING_KIND, OPERATION_CODE, POSTING_CODE } from "./constants";

export const OPERATION_TRANSFER_TYPE = {
  CREATE: "create",
  POST_PENDING: "post_pending",
  VOID_PENDING: "void_pending",
} as const;

export type Dimensions = Record<string, string>;

interface PendingConfig {
  timeoutSeconds: number;
  ref?: string | null;
}

interface AccountSide {
  accountNo: string;
  currency: string;
  dimensions: Dimensions;
}

export interface CreateIntentLine {
  type: typeof OPERATION_TRANSFER_TYPE.CREATE;
  planRef: string;
  postingCode: string;
  debit: AccountSide;
  credit: AccountSide;
  amountMinor: bigint;
  code?: number;
  pending?: PendingConfig;
  chain?: string | null;
  memo?: string | null;
  context?: Record<string, string> | null;
}

export interface PostPendingIntentLine {
  type: typeof OPERATION_TRANSFER_TYPE.POST_PENDING;
  planRef: string;
  currency: string;
  pendingId: bigint;
  amount?: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export interface VoidPendingIntentLine {
  type: typeof OPERATION_TRANSFER_TYPE.VOID_PENDING;
  planRef: string;
  currency: string;
  pendingId: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export type IntentLine =
  | CreateIntentLine
  | PostPendingIntentLine
  | VoidPendingIntentLine;

export interface TransferPostingBinding {
  accountId: string;
  counterpartyId: string;
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
  lines: IntentLine[];
  sourcePendingRef: string;
  destinationPendingRef: string | null;
}

export interface TransferPendingActionTemplateResult {
  operationCode:
    | typeof OPERATION_CODE.TRANSFER_SETTLE_PENDING
    | typeof OPERATION_CODE.TRANSFER_VOID_PENDING;
  lines: IntentLine[];
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
      lines: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planRef: makePlanKey("transfer_v3_approve_intra", {
            transferId: input.transferId,
            sourceOperationalAccountId: input.source.accountId,
            destinationOperationalAccountId: input.destination.accountId,
            amount: input.amountMinor.toString(),
            currency: input.source.currencyCode,
            settlementMode: input.settlementMode,
          }),
          postingCode:
            input.settlementMode === "pending"
              ? POSTING_CODE.TRANSFER_INTRA_PENDING
              : POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
          debit: {
            accountNo: ACCOUNT_NO.BANK,
            currency: input.source.currencyCode,
            dimensions: { operationalAccountId: input.destination.accountId },
          },
          credit: {
            accountNo: ACCOUNT_NO.BANK,
            currency: input.source.currencyCode,
            dimensions: { operationalAccountId: input.source.accountId },
          },
          amountMinor: input.amountMinor,
          code: TransferCodes.INTERNAL_TRANSFER,
          pending:
            input.settlementMode === "pending"
              ? {
                  timeoutSeconds: input.timeoutSeconds,
                  ref: sourcePendingRef,
                }
              : undefined,
          memo: input.memo ?? null,
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
    lines: [
      {
        type: OPERATION_TRANSFER_TYPE.CREATE,
        planRef: makePlanKey("transfer_v3_approve_cross_source", {
          transferId: input.transferId,
          sourceOperationalAccountId: input.source.accountId,
          destinationOperationalAccountId: input.destination.accountId,
          amount: input.amountMinor.toString(),
          currency: input.source.currencyCode,
          settlementMode: input.settlementMode,
        }),
        postingCode:
          input.settlementMode === "pending"
            ? POSTING_CODE.TRANSFER_CROSS_SOURCE_PENDING
            : POSTING_CODE.TRANSFER_CROSS_SOURCE_IMMEDIATE,
        debit: {
          accountNo: ACCOUNT_NO.CLEARING,
          currency: input.source.currencyCode,
          dimensions: {
            clearingKind: CLEARING_KIND.INTERCOMPANY,
            counterpartyId: input.destination.counterpartyId,
          },
        },
        credit: {
          accountNo: ACCOUNT_NO.BANK,
          currency: input.source.currencyCode,
          dimensions: { operationalAccountId: input.source.accountId },
        },
        amountMinor: input.amountMinor,
        code: TransferCodes.INTERNAL_TRANSFER,
        pending:
          input.settlementMode === "pending"
            ? {
                timeoutSeconds: input.timeoutSeconds,
                ref: sourcePendingRef,
              }
            : undefined,
        memo: input.memo ?? null,
      },
      {
        type: OPERATION_TRANSFER_TYPE.CREATE,
        planRef: makePlanKey("transfer_v3_approve_cross_destination", {
          transferId: input.transferId,
          sourceOperationalAccountId: input.source.accountId,
          destinationOperationalAccountId: input.destination.accountId,
          amount: input.amountMinor.toString(),
          currency: input.source.currencyCode,
          settlementMode: input.settlementMode,
        }),
        postingCode:
          input.settlementMode === "pending"
            ? POSTING_CODE.TRANSFER_CROSS_DEST_PENDING
            : POSTING_CODE.TRANSFER_CROSS_DEST_IMMEDIATE,
        debit: {
          accountNo: ACCOUNT_NO.BANK,
          currency: input.source.currencyCode,
          dimensions: { operationalAccountId: input.destination.accountId },
        },
        credit: {
          accountNo: ACCOUNT_NO.CLEARING,
          currency: input.source.currencyCode,
          dimensions: {
            clearingKind: CLEARING_KIND.INTERCOMPANY,
            counterpartyId: input.source.counterpartyId,
          },
        },
        amountMinor: input.amountMinor,
        code: TransferCodes.INTERNAL_TRANSFER,
        pending:
          input.settlementMode === "pending"
            ? {
                timeoutSeconds: input.timeoutSeconds,
                ref: destinationPendingRef,
              }
            : undefined,
        memo: input.memo ?? null,
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

  const lines = input.pendingIds.map((pendingId, idx) => {
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
      } satisfies PostPendingIntentLine;
    }

    return {
      type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
      planRef,
      currency: input.currency,
      pendingId,
    } satisfies VoidPendingIntentLine;
  });

  return {
    operationCode,
    lines,
  };
}

export function resolveInLedgerFeePostingTemplate(
  kind: string,
): FeePostingTemplate {
  if (kind === "fx_spread") {
    return {
      postingCode: POSTING_CODE.SPREAD_INCOME,
      debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
      creditAccountNo: ACCOUNT_NO.SPREAD_REVENUE,
      transferCode: TransferCodes.SPREAD_INCOME,
      feeBucket: "spread",
    };
  }

  if (
    kind === "bank_fee" ||
    kind === "blockchain_fee" ||
    kind === "manual_fee"
  ) {
    return {
      postingCode: POSTING_CODE.FEE_INCOME,
      debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
      creditAccountNo: ACCOUNT_NO.FEE_REVENUE,
      transferCode: TransferCodes.FEE_INCOME,
      feeBucket:
        kind === "bank_fee"
          ? "bank"
          : kind === "blockchain_fee"
            ? "blockchain"
            : "manual",
    };
  }

  return {
    postingCode: POSTING_CODE.FEE_INCOME,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_REVENUE,
    transferCode: TransferCodes.FEE_INCOME,
    feeBucket: kind,
  };
}

export function resolveFeeReservePostingTemplate(
  bucket: string,
): FeePostingTemplate {
  return {
    postingCode: POSTING_CODE.FEE_PASS_THROUGH_RESERVE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_CLEARING,
    transferCode: TransferCodes.FEE_PASS_THROUGH_RESERVE,
    feeBucket: bucket,
  };
}

export function resolveProviderFeeExpenseAccrualPostingTemplate(
  bucket: string,
): FeePostingTemplate {
  return {
    postingCode: POSTING_CODE.PROVIDER_FEE_EXPENSE_ACCRUAL,
    debitAccountNo: ACCOUNT_NO.PROVIDER_FEE_EXPENSE,
    creditAccountNo: ACCOUNT_NO.FEE_CLEARING,
    transferCode: TransferCodes.PROVIDER_FEE_EXPENSE_ACCRUAL,
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
      postingCode: POSTING_CODE.FEE_PASS_THROUGH_RESERVE,
      debitAccountNo: ACCOUNT_NO.ADJUSTMENT_EXPENSE,
      creditAccountNo: ACCOUNT_NO.FEE_CLEARING,
      transferCode: TransferCodes.FEE_PASS_THROUGH_RESERVE,
      feeBucket: `adjustment:${kind}`,
    };
  }

  return {
    postingCode: POSTING_CODE.FEE_PASS_THROUGH_RESERVE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_CLEARING,
    transferCode: TransferCodes.FEE_PASS_THROUGH_RESERVE,
    feeBucket: `adjustment:${kind}`,
  };
}
