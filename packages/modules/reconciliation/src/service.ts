import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database, Transaction } from "@bedrock/platform/persistence";

import type { ReconciliationExceptionsTxRepository } from "./application/exceptions/ports";
import {
  createExplainMatchHandler,
  createListExceptionsHandler,
} from "./application/exceptions/queries";
import { createIngestExternalRecordHandler } from "./application/records/commands";
import type { ReconciliationExternalRecordsTxRepository } from "./application/records/ports";
import { createRunReconciliationHandler } from "./application/runs/commands";
import type {
  ReconciliationMatchesTxRepository,
  ReconciliationRunsTxRepository,
} from "./application/runs/ports";
import { createReconciliationServiceContext } from "./application/shared/context";
import type {
  ReconciliationDocumentsPort,
  ReconciliationLedgerLookupPort,
  ReconciliationTransactionIdempotencyPort,
  ReconciliationTransactionsPort,
} from "./application/shared/external-ports";
import { createDrizzleReconciliationServiceAdapters } from "./infra/drizzle/context";

export type ReconciliationService = ReturnType<
  typeof createReconciliationService
>;

export interface ReconciliationServiceDeps {
  db: Database;
  documents: ReconciliationDocumentsPort;
  idempotency: IdempotencyPort;
  ledgerLookup: ReconciliationLedgerLookupPort;
  logger?: Logger;
}

function createExternalRecordsTxRepository(input: {
  externalRecords: ReturnType<
    typeof createDrizzleReconciliationServiceAdapters
  >["externalRecordsRepo"];
  tx: Transaction;
}): ReconciliationExternalRecordsTxRepository {
  return {
    findBySourceAndSourceRecordId(params) {
      return input.externalRecords.findBySourceAndSourceRecordIdTx(
        input.tx,
        params,
      );
    },
    create(record) {
      return input.externalRecords.createTx(input.tx, record);
    },
    listForRun(params) {
      return input.externalRecords.listForRunTx(input.tx, params);
    },
  };
}

function createRunsTxRepository(input: {
  runs: ReturnType<
    typeof createDrizzleReconciliationServiceAdapters
  >["runsRepo"];
  tx: Transaction;
}): ReconciliationRunsTxRepository {
  return {
    findById(id) {
      return input.runs.findByIdTx(input.tx, id);
    },
    create(run) {
      return input.runs.createTx(input.tx, run);
    },
  };
}

function createMatchesTxRepository(input: {
  matches: ReturnType<
    typeof createDrizzleReconciliationServiceAdapters
  >["matchesRepo"];
  tx: Transaction;
}): ReconciliationMatchesTxRepository {
  return {
    createMany(rows) {
      return input.matches.createManyTx(input.tx, rows);
    },
  };
}

function createExceptionsTxRepository(input: {
  exceptions: ReturnType<
    typeof createDrizzleReconciliationServiceAdapters
  >["exceptionsRepo"];
  tx: Transaction;
}): ReconciliationExceptionsTxRepository {
  return {
    findByIdForUpdate(id) {
      return input.exceptions.findByIdForUpdateTx(input.tx, id);
    },
    createMany(rows) {
      return input.exceptions.createManyTx(input.tx, rows);
    },
    markResolved(update) {
      return input.exceptions.markResolvedTx(input.tx, update);
    },
  };
}

export function createReconciliationTransactions(input: {
  db: Database;
  idempotency: IdempotencyPort;
  externalRecords: ReturnType<
    typeof createDrizzleReconciliationServiceAdapters
  >["externalRecordsRepo"];
  runs: ReturnType<
    typeof createDrizzleReconciliationServiceAdapters
  >["runsRepo"];
  matches: ReturnType<
    typeof createDrizzleReconciliationServiceAdapters
  >["matchesRepo"];
  exceptions: ReturnType<
    typeof createDrizzleReconciliationServiceAdapters
  >["exceptionsRepo"];
}): ReconciliationTransactionsPort {
  return {
    async withTransaction(run) {
      return input.db.transaction(async (tx: Transaction) => {
        const idempotency: ReconciliationTransactionIdempotencyPort = {
          withIdempotency<
            TResult,
            TStoredResult = Record<string, unknown>,
          >(params: {
            scope: string;
            idempotencyKey: string;
            request: unknown;
            actorId?: string | null;
            handler: () => Promise<TResult>;
            serializeResult: (result: TResult) => TStoredResult;
            loadReplayResult: (params: {
              storedResult: TStoredResult | null;
            }) => Promise<TResult>;
            serializeError?: (error: unknown) => Record<string, unknown>;
          }) {
            return input.idempotency.withIdempotencyTx<TResult, TStoredResult>({
              tx,
              scope: params.scope,
              idempotencyKey: params.idempotencyKey,
              request: params.request,
              actorId: params.actorId,
              handler: params.handler,
              serializeResult: params.serializeResult,
              loadReplayResult: ({ storedResult }) =>
                params.loadReplayResult({
                  storedResult: (storedResult as TStoredResult | null) ?? null,
                }),
              serializeError: params.serializeError,
            });
          },
        };

        return run({
          externalRecords: createExternalRecordsTxRepository({
            externalRecords: input.externalRecords,
            tx,
          }),
          runs: createRunsTxRepository({
            runs: input.runs,
            tx,
          }),
          matches: createMatchesTxRepository({
            matches: input.matches,
            tx,
          }),
          exceptions: createExceptionsTxRepository({
            exceptions: input.exceptions,
            tx,
          }),
          idempotency,
        });
      });
    },
  };
}

export function createReconciliationService(deps: ReconciliationServiceDeps) {
  const adapters = createDrizzleReconciliationServiceAdapters(deps.db);
  const context = createReconciliationServiceContext({
    documents: deps.documents,
    ledgerLookup: deps.ledgerLookup,
    logger: deps.logger,
    matches: adapters.matchesRepo,
    exceptions: adapters.exceptionsRepo,
    pendingSources: adapters.pendingSources,
    transactions: createReconciliationTransactions({
      db: deps.db,
      idempotency: deps.idempotency,
      externalRecords: adapters.externalRecordsRepo,
      runs: adapters.runsRepo,
      matches: adapters.matchesRepo,
      exceptions: adapters.exceptionsRepo,
    }),
  });

  return {
    records: {
      ingestExternalRecord: createIngestExternalRecordHandler(context),
    },
    runs: {
      runReconciliation: createRunReconciliationHandler(context),
    },
    exceptions: {
      listExceptions: createListExceptionsHandler(context),
      explainMatch: createExplainMatchHandler(context),
    },
  };
}
