import {
  createPersistenceContext,
  type Database,
} from "@bedrock/platform/persistence";
import type {
  BedrockWorker,
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/platform/worker-runtime";

import {
  DrizzleDocumentsPostingWorkerReads,
  DrizzleDocumentsPostingWorkerUnitOfWork,
} from "../adapters/drizzle";
import { FinalizePostingResultsCommand } from "./application/commands/finalize-posting-results";

export interface DocumentsWorkerItemContext {
  documentId: string;
  operationId: string;
  moduleId: string;
  bookIds: string[];
}

type DocumentsWorkerItemGuard = (
  input: DocumentsWorkerItemContext,
) => Promise<boolean> | boolean;

export function createDocumentsWorkerDefinition(deps: {
  id?: string;
  intervalMs?: number;
  db: Database;
  beforeDocument?: DocumentsWorkerItemGuard;
  batchSize?: number;
}): BedrockWorker {
  const finalizePostingResults = new FinalizePostingResultsCommand(
    new DrizzleDocumentsPostingWorkerReads(deps.db),
    new DrizzleDocumentsPostingWorkerUnitOfWork({
      persistence: createPersistenceContext(deps.db),
    }),
  );

  async function runOnce(ctx: WorkerRunContext): Promise<WorkerRunResult> {
    const processed = await finalizePostingResults.execute({
      batchSize: deps.batchSize ?? 50,
      now: ctx.now,
      beforeDocument: deps.beforeDocument,
    });
    return { processed };
  }

  return {
    id: deps.id ?? "documents",
    intervalMs: deps.intervalMs ?? 5_000,
    runOnce,
  };
}
