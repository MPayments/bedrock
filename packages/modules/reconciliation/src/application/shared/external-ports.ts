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

export interface ReconciliationExecutionFillInput {
  actualRateDen: bigint | null;
  actualRateNum: bigint | null;
  boughtAmountMinor: bigint | null;
  boughtCurrencyId: string | null;
  calculationSnapshotId: string | null;
  confirmedAt: Date | null;
  executedAt: Date | null;
  externalRecordId: string | null;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  routeVersionId: string | null;
  routeLegId: string | null;
  soldAmountMinor: bigint | null;
  soldCurrencyId: string | null;
  sourceRef: string;
}

export interface ReconciliationExecutionFeeInput {
  amountMinor: bigint | null;
  calculationSnapshotId: string | null;
  chargedAt: Date | null;
  componentCode: string | null;
  confirmedAt: Date | null;
  currencyId: string | null;
  externalRecordId: string | null;
  feeFamily: string;
  fillId: string | null;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  routeComponentId: string | null;
  routeVersionId: string | null;
  routeLegId: string | null;
  sourceRef: string;
}

export interface ReconciliationCashMovementInput {
  accountRef: string | null;
  amountMinor: bigint | null;
  bookedAt: Date | null;
  calculationSnapshotId: string | null;
  confirmedAt: Date | null;
  currencyId: string | null;
  direction: "credit" | "debit";
  externalRecordId: string | null;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  requisiteId: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  sourceRef: string;
  statementRef: string | null;
  valueDate: Date | null;
}

export interface ReconciliationExecutionFactsTxPort {
  recordExecutionFill(
    input: ReconciliationExecutionFillInput,
  ): Promise<void>;
  recordExecutionFee(
    input: ReconciliationExecutionFeeInput,
  ): Promise<void>;
  recordCashMovement(
    input: ReconciliationCashMovementInput,
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
