import type {
  CompiledPack,
  ResolvePostingPlanInput,
  ResolvePostingPlanResult,
} from "@bedrock/accounting";
import type { IdempotencyPort } from "@bedrock/core/idempotency";
import type {
  CommitResult,
  LedgerOperationDetails,
  OperationIntent,
} from "@bedrock/ledger";
import type { Transaction } from "@bedrock/persistence";

export interface DocumentsAccountingPort {
  getDefaultCompiledPack(): CompiledPack;
  loadActiveCompiledPackForBook(input?: {
    bookId?: string;
    at?: Date;
  }): Promise<CompiledPack>;
  resolvePostingPlan(
    input: ResolvePostingPlanInput,
  ): Promise<ResolvePostingPlanResult>;
}

export interface DocumentsLedgerCommitPort {
  commit(tx: Transaction, intent: OperationIntent): Promise<CommitResult>;
}

export interface DocumentsLedgerReadPort {
  getOperationDetails(operationId: string): Promise<LedgerOperationDetails | null>;
}

export type DocumentsIdempotencyPort = IdempotencyPort;
