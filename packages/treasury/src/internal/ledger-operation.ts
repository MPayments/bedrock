import {
  OPERATION_TRANSFER_TYPE,
  type CreateOperationInput,
  type TransferPlanLine,
} from "@bedrock/ledger";

type CreateTransferAnalytics = Extract<
  TransferPlanLine,
  { type: typeof OPERATION_TRANSFER_TYPE.CREATE }
>["analytics"];

interface TemplateCreateTransferPlan {
  type: typeof OPERATION_TRANSFER_TYPE.CREATE;
  planKey: string;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
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

interface TemplatePostPendingTransferPlan {
  type: typeof OPERATION_TRANSFER_TYPE.POST_PENDING;
  planKey: string;
  currency: string;
  pendingId: bigint;
  amount?: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

interface TemplateVoidPendingTransferPlan {
  type: typeof OPERATION_TRANSFER_TYPE.VOID_PENDING;
  planKey: string;
  currency: string;
  pendingId: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export type TemplateTransferPlan =
  | TemplateCreateTransferPlan
  | TemplatePostPendingTransferPlan
  | TemplateVoidPendingTransferPlan;

interface BuildTreasuryOperationInput {
  source: CreateOperationInput["source"];
  operationCode: string;
  operationVersion?: number;
  payload?: unknown;
  idempotencyKey: string;
  postingDate: Date;
  bookOrgId: string;
  transfers: TemplateTransferPlan[];
}

function toTransferPlan(
  bookOrgId: string,
  transfer: TemplateTransferPlan,
): TransferPlanLine {
  if (transfer.type === OPERATION_TRANSFER_TYPE.CREATE) {
    return {
      type: OPERATION_TRANSFER_TYPE.CREATE,
      planRef: transfer.planKey,
      bookOrgId,
      postingCode: transfer.postingCode,
      debitAccountNo: transfer.debitAccountNo,
      creditAccountNo: transfer.creditAccountNo,
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

  if (transfer.type === OPERATION_TRANSFER_TYPE.POST_PENDING) {
    return {
      type: OPERATION_TRANSFER_TYPE.POST_PENDING,
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
    type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
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
