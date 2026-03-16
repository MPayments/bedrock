export interface CreateIntentLine {
  type: "create";
  planRef: string;
  bookId: string;
  postingCode: string;
  debit: {
    accountNo: string;
    currency: string;
    dimensions: Record<string, string>;
  };
  credit: {
    accountNo: string;
    currency: string;
    dimensions: Record<string, string>;
  };
  amountMinor: bigint;
  code?: number;
  pending?: {
    timeoutSeconds: number;
    ref?: string | null;
  };
  chain?: string | null;
  memo?: string | null;
}

export interface PostPendingIntentLine {
  type: "post_pending";
  planRef: string;
  currency: string;
  pendingId: bigint;
  amount?: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export interface VoidPendingIntentLine {
  type: "void_pending";
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
