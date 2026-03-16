import { canonicalJson } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Database } from "@bedrock/platform/persistence";

import {
  CreateAdjustmentDocumentInputSchema,
  type CreateAdjustmentDocumentInput,
  type CreateAdjustmentDocumentResult,
} from "./contracts";
import { RECONCILIATION_IDEMPOTENCY_SCOPE } from "./domain/idempotency";
import { ReconciliationException } from "./domain/reconciliation-exception";
import { ReconciliationExceptionNotFoundError } from "./errors";
import { toCreateAdjustmentDocumentResult } from "./application/mappers";
import type { ReconciliationAdjustmentDocumentsPort } from "./application/shared/external-ports";
import { createDrizzleReconciliationServiceAdapters } from "./infra/drizzle/context";
import { createReconciliationTransactions } from "./service";

export interface ReconciliationAdjustmentsServiceDeps {
  db: Database;
  documents: ReconciliationAdjustmentDocumentsPort;
  idempotency: IdempotencyPort;
}

export function createReconciliationAdjustmentsService(
  deps: ReconciliationAdjustmentsServiceDeps,
) {
  const adapters = createDrizzleReconciliationServiceAdapters(deps.db);
  const transactions = createReconciliationTransactions({
    db: deps.db,
    idempotency: deps.idempotency,
    externalRecords: adapters.externalRecordsRepo,
    runs: adapters.runsRepo,
    matches: adapters.matchesRepo,
    exceptions: adapters.exceptionsRepo,
  });

  return {
    async createAdjustmentDocument(
      input: CreateAdjustmentDocumentInput,
    ): Promise<CreateAdjustmentDocumentResult> {
      const validated = CreateAdjustmentDocumentInputSchema.parse(input);

      const result = await transactions.withTransaction(
        async ({ exceptions, idempotency }) =>
          idempotency.withIdempotency({
            scope: RECONCILIATION_IDEMPOTENCY_SCOPE.CREATE_ADJUSTMENT_DOCUMENT,
            idempotencyKey: validated.idempotencyKey,
            request: validated,
            actorId: validated.actorUserId,
            serializeResult: (value: {
              exceptionId: string;
              documentId: string;
            }) => value,
            loadReplayResult: async ({ storedResult }) => ({
              exceptionId: validated.exceptionId,
              documentId: String(storedResult?.documentId ?? ""),
            }),
            handler: async () => {
              const exception = await exceptions.findByIdForUpdate(
                validated.exceptionId,
              );

              if (!exception) {
                throw new ReconciliationExceptionNotFoundError(
                  validated.exceptionId,
                );
              }

              const existingException =
                ReconciliationException.fromSnapshot(exception);
              const existingResolution =
                existingException.resolveWithAdjustment({
                  adjustmentDocumentId: exception.adjustmentDocumentId ?? "",
                  resolvedAt: new Date(),
                });

              if (existingResolution.alreadyResolved) {
                return {
                  exceptionId: existingResolution.exceptionId,
                  documentId: existingResolution.documentId,
                };
              }

              const createIdempotencyKey =
                validated.createIdempotencyKey ??
                sha256Hex(
                  canonicalJson({
                    action: "reconciliation.createAdjustmentDocument",
                    exceptionId: validated.exceptionId,
                    docType: validated.docType,
                    payload: validated.payload,
                  }),
                );

              const created = await deps.documents.createDraft({
                docType: validated.docType,
                createIdempotencyKey,
                payload: validated.payload,
                actorUserId: validated.actorUserId,
                requestContext: validated.requestContext,
              });

              const resolved = existingException.resolveWithAdjustment({
                adjustmentDocumentId: created.document.id,
                resolvedAt: new Date(),
              });
              await exceptions.markResolved(resolved.update!);

              return {
                exceptionId: resolved.exceptionId,
                documentId: resolved.documentId,
              };
            },
          }),
      );

      return toCreateAdjustmentDocumentResult(result);
    },
  };
}

export type ReconciliationAdjustmentsService = ReturnType<
  typeof createReconciliationAdjustmentsService
>;
