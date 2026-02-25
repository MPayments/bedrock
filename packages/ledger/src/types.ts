export enum PlanType {
  CREATE = "create",
  POST_PENDING = "post_pending",
  VOID_PENDING = "void_pending",
}

export interface PostingAnalytics {
  counterpartyId?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  operationalAccountId?: string | null;
  transferId?: string | null;
  quoteId?: string | null;
  feeBucket?: string | null;
}

export interface CreatePlan {
  type: PlanType.CREATE;
  planRef: string;
  bookOrgId: string;

  debitAccountNo: string;
  creditAccountNo: string;
  postingCode: string;

  currency: string;
  amount: bigint;

  code?: number;

  pending?: {
    timeoutSeconds: number;
    ref?: string | null;
  };

  chain?: string | null;

  memo?: string | null;
  analytics?: PostingAnalytics;
}

export interface PostPendingPlan {
  type: PlanType.POST_PENDING;
  planRef: string;

  currency: string;
  pendingId: bigint;

  amount?: bigint;

  code?: number;

  chain?: string | null;

  memo?: string | null;
}

export interface VoidPendingPlan {
  type: PlanType.VOID_PENDING;
  planRef: string;

  currency: string;
  pendingId: bigint;

  code?: number;

  chain?: string | null;

  memo?: string | null;
}

export type TransferPlanLine = CreatePlan | PostPendingPlan | VoidPendingPlan;

export interface CreateOperationInput {
  source: {
    type: string;
    id: string;
  };
  operationCode: string;
  operationVersion?: number;
  payload?: unknown;
  idempotencyKey: string;
  postingDate: Date;

  transfers: TransferPlanLine[];
}

export interface CreateOperationResult {
  operationId: string;
  pendingTransferIdsByRef: Map<string, bigint>;
  transferIds: Map<number, bigint>;
}
