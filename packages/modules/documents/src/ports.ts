import type {
  CompiledPack,
  ResolvePostingPlanInput,
  ResolvePostingPlanResult,
} from "@bedrock/accounting";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type {
  CommitResult,
  LedgerOperationDetails,
  OperationIntent,
} from "@bedrock/ledger";
import type { Database, Transaction } from "@bedrock/platform/persistence";

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

export interface DocumentsAccountingPeriodsPort {
  assertOrganizationPeriodsOpen(input: {
    db?: Database | Transaction;
    occurredAt: Date;
    organizationIds: string[];
    docType: string;
  }): Promise<void>;
  closePeriod(input: {
    db?: Database | Transaction;
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closedBy: string;
    closeReason?: string | null;
    closeDocumentId: string;
  }): Promise<unknown>;
  isOrganizationPeriodClosed(input: {
    db?: Database | Transaction;
    organizationId: string;
    occurredAt: Date;
  }): Promise<boolean>;
  reopenPeriod(input: {
    db?: Database | Transaction;
    organizationId: string;
    periodStart: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenDocumentId?: string | null;
  }): Promise<unknown>;
}

export interface DocumentsLedgerCommitPort {
  commit(tx: Transaction, intent: OperationIntent): Promise<CommitResult>;
}

export interface DocumentsLedgerReadPort {
  getOperationDetails(operationId: string): Promise<LedgerOperationDetails | null>;
}

export type DocumentsIdempotencyPort = IdempotencyPort;
