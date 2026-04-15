import type { ReconciliationExceptionsTxRepository } from "../exceptions/ports";
import type { ReconciliationExternalRecordsTxRepository } from "../records/ports";
import type {
  ReconciliationMatchesTxRepository,
  ReconciliationRunsTxRepository,
} from "../runs/ports";

export interface ReconciliationDocumentsPort {
  existsById(documentId: string): Promise<boolean>;
}

export interface ReconciliationLedgerLookupPort {
  operationExists(operationId: string): Promise<boolean>;
  treasuryOperationExists(operationId: string): Promise<boolean>;
}

export interface ReconciliationExecutionFactsInput {
  amountMinor: bigint | null;
  confirmedAt: Date | null;
  counterAmountMinor: bigint | null;
  counterCurrencyId: string | null;
  currencyId: string | null;
  externalRecordId: string | null;
  feeAmountMinor: bigint | null;
  feeCurrencyId: string | null;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerRef: string | null;
  recordedAt: Date | null;
  routeLegId: string | null;
  sourceRef: string;
}

export interface ReconciliationExecutionFactsTxPort {
  recordTreasuryOperationFact(
    input: ReconciliationExecutionFactsInput,
  ): Promise<void>;
}

type JsonRecord = Record<string, unknown>;

export interface ReconciliationTransactionIdempotencyPort {
  withIdempotency<TResult, TStoredResult = JsonRecord>(input: {
    scope: string;
    idempotencyKey: string;
    request: unknown;
    actorId?: string | null;
    handler: () => Promise<TResult>;
    serializeResult: (result: TResult) => TStoredResult;
    loadReplayResult: (params: {
      storedResult: TStoredResult | null;
    }) => Promise<TResult>;
    serializeError?: (error: unknown) => JsonRecord;
  }): Promise<TResult>;
}

export interface ReconciliationTransactionContext {
  externalRecords: ReconciliationExternalRecordsTxRepository;
  runs: ReconciliationRunsTxRepository;
  matches: ReconciliationMatchesTxRepository;
  exceptions: ReconciliationExceptionsTxRepository;
  executionFacts: ReconciliationExecutionFactsTxPort;
  idempotency: ReconciliationTransactionIdempotencyPort;
}

export interface ReconciliationTransactionsPort {
  withTransaction<TResult>(
    run: (context: ReconciliationTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}
