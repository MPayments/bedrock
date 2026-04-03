import type {
  CompiledPack,
  ResolvePostingPlanInput,
  ResolvePostingPlanResult,
} from "@bedrock/accounting/contracts";
import type {
  CommitResult,
  LedgerOperationDetails,
  OperationIntent,
} from "@bedrock/ledger/contracts";

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
    occurredAt: Date;
    organizationIds: string[];
    docType: string;
  }): Promise<void>;
  listClosedOrganizationIdsForPeriod(input: {
    organizationIds: string[];
    occurredAt: Date;
  }): Promise<string[]>;
  closePeriod(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closedBy: string;
    closeReason?: string | null;
    closeDocumentId: string;
    db?: unknown;
  }): Promise<unknown>;
  isOrganizationPeriodClosed(input: {
    organizationId: string;
    occurredAt: Date;
  }): Promise<boolean>;
  reopenPeriod(input: {
    organizationId: string;
    periodStart: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenDocumentId?: string | null;
    db?: unknown;
  }): Promise<unknown>;
}

export interface DocumentsLedgerCommitPort {
  commit(intent: OperationIntent): Promise<CommitResult>;
}

export interface DocumentsLedgerReadPort {
  listOperationDetails(
    operationIds: string[],
  ): Promise<Map<string, LedgerOperationDetails>>;
  getOperationDetails(operationId: string): Promise<LedgerOperationDetails | null>;
}
