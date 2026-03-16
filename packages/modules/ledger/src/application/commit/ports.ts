import type { Transaction } from "@bedrock/platform/persistence";

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

export interface LedgerTransferPlanInsert {
  operationId: string;
  lineNo: number;
  type: "create" | "post_pending" | "void_pending";
  transferId: bigint;
  debitTbAccountId: bigint | null;
  creditTbAccountId: bigint | null;
  tbLedger: number;
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

export interface LedgerOperationsWritePort {
  acquireOperationId: (
    tx: Transaction,
    input: AcquireOperationIdInput,
  ) => Promise<{ operationId: string; isIdempotentReplay: boolean }>;
  isReplayIncomplete: (tx: Transaction, input: {
    operationId: string;
    lines: IntentLine[];
  }) => Promise<boolean>;
  insertPostings: (
    tx: Transaction,
    rows: LedgerPostingInsert[],
  ) => Promise<void>;
  insertTransferPlans: (
    tx: Transaction,
    rows: LedgerTransferPlanInsert[],
  ) => Promise<void>;
  enqueuePostOperation: (tx: Transaction, operationId: string) => Promise<void>;
}

export type LedgerCommitResult = CommitResult;
