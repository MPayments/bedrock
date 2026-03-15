import { createAdjustmentDocumentHandler } from "./application/adjustments/commands";
import {
  createExplainMatchHandler,
  createListExceptionsHandler,
} from "./application/exceptions/queries";
import { createIngestExternalRecordHandler } from "./application/records/commands";
import { createRunReconciliationHandler } from "./application/runs/commands";
import {
  createReconciliationServiceContext,
  type ReconciliationServiceDeps,
} from "./application/shared/context";

export type { ReconciliationServiceDeps } from "./application/shared/context";

export type ReconciliationService = ReturnType<
  typeof createReconciliationService
>;

export function createReconciliationService(deps: ReconciliationServiceDeps) {
  const context = createReconciliationServiceContext(deps);

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
    adjustments: {
      createAdjustmentDocument: createAdjustmentDocumentHandler(context),
    },
  };
}
