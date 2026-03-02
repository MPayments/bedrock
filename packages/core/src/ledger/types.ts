import type { Dimensions } from "@bedrock/core/ledger/schema";

export const OPERATION_TRANSFER_TYPE = {
  CREATE: "create",
  POST_PENDING: "post_pending",
  VOID_PENDING: "void_pending",
} as const;

export type OperationTransferType =
  (typeof OPERATION_TRANSFER_TYPE)[keyof typeof OPERATION_TRANSFER_TYPE];

export interface CreateIntentLine {
  type: typeof OPERATION_TRANSFER_TYPE.CREATE;
  planRef: string;
  bookId: string;

  postingCode: string;
  debit: {
    accountNo: string;
    currency: string;
    dimensions: Dimensions;
  };
  credit: {
    accountNo: string;
    currency: string;
    dimensions: Dimensions;
  };

  amountMinor: bigint;

  code?: number;

  pending?: {
    timeoutSeconds: number;
    ref?: string | null;
  };

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

export type IntentLine = CreateIntentLine | PostPendingIntentLine | VoidPendingIntentLine;

export interface OperationIntent {
  source: {
    type: string;
    id: string;
  };
  operationCode: string;
  operationVersion?: number;
  payload?: unknown;
  idempotencyKey: string;
  postingDate: Date;

  lines: IntentLine[];
}

export interface CommitResult {
  operationId: string;
  pendingTransferIdsByRef: Map<string, bigint>;
}
