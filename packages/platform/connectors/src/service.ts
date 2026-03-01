import { createCreateIntentFromDocumentHandler } from "./commands/create-intent-from-document";
import { createEnqueueAttemptHandler } from "./commands/enqueue-attempt";
import { createHandleWebhookEventHandler } from "./commands/handle-webhook-event";
import { createIngestStatementBatchHandler } from "./commands/ingest-statement-batch";
import { createMarkIntentTerminalHandler } from "./commands/mark-intent-terminal";
import { createQueryHandlers } from "./commands/queries";
import { createRecordAttemptStatusHandler } from "./commands/record-attempt-status";
import {
  createConnectorsServiceContext,
  type ConnectorsServiceContext,
} from "./internal/context";
import type { ConnectorsServiceDeps } from "./types";

export type ConnectorsService = ReturnType<typeof createConnectorsService>;

export function createConnectorsService(deps: ConnectorsServiceDeps) {
  const context = createConnectorsServiceContext(deps);

  const createIntentFromDocument =
    createCreateIntentFromDocumentHandler(context);
  const enqueueAttempt = createEnqueueAttemptHandler(context);
  const recordAttemptStatus = createRecordAttemptStatusHandler(context);
  const markIntentTerminal = createMarkIntentTerminalHandler(context);
  const handleWebhookEvent = createHandleWebhookEventHandler(context, {
    recordAttemptStatus,
  });
  const ingestStatementBatch = createIngestStatementBatchHandler(context);
  const queries = createQueryHandlers(context);

  return {
    createIntentFromDocument,
    enqueueAttempt,
    recordAttemptStatus,
    handleWebhookEvent,
    ingestStatementBatch,
    markIntentTerminal,
    ...queries,
    providers: context.providers,
  };
}

export type { ConnectorsServiceContext };
