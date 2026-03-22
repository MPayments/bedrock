import type { CommitResult, IntentLine } from "../../domain/operation-intent";

export interface LedgerPostingInsert {
  operationId: string;
  lineNo: number;
  bookId: string;
  debitInstanceId: string;
  creditInstanceId: string;
  postingCode: string;
  currency: string;
  amountMinor: bigint;
  memo: string | null;
  context: Record<string, string> | null;
}

export interface LedgerSettlementPlan {
  operationId: string;
  lineNo: number;
  type: "create" | "post_pending" | "void_pending";
  settlementId: bigint;
  debitAccountId: bigint | null;
  creditAccountId: bigint | null;
  settlementLedger: number;
  amount: bigint;
  code: number;
  pendingRef: string | null;
  pendingId: bigint | null;
  isLinked: boolean;
  isPending: boolean;
  timeoutSeconds: number;
  status: "pending" | "posted" | "failed";
}

export interface AcquireOperationIdInput {
  source: {
    type: string;
    id: string;
  };
  operationCode: string;
  operationVersion: number;
  idempotencyKey: string;
  payloadHash: string;
  postingDate: Date;
}

export interface LedgerOperationsRepository {
  acquireOperationId: (
    input: AcquireOperationIdInput,
  ) => Promise<{ operationId: string; isIdempotentReplay: boolean }>;
  isReplayIncomplete: (input: {
    operationId: string;
    lines: IntentLine[];
  }) => Promise<boolean>;
  insertPostings: (rows: LedgerPostingInsert[]) => Promise<void>;
  insertSettlementPlans: (rows: LedgerSettlementPlan[]) => Promise<void>;
  enqueuePostOperation: (operationId: string) => Promise<void>;
}

export type LedgerCommitResult = CommitResult;
