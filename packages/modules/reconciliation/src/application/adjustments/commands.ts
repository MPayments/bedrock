import { sha256Hex } from "@bedrock/platform/crypto";
import { canonicalJson } from "@bedrock/shared/core/canon";

import {
  CreateAdjustmentDocumentInputSchema,
  type CreateAdjustmentDocumentInput,
  type CreateAdjustmentDocumentResult,
} from "../../contracts";
import { RECONCILIATION_IDEMPOTENCY_SCOPE } from "../../domain/idempotency";
import { ReconciliationException } from "../../domain/reconciliation-exception";
import { ReconciliationExceptionNotFoundError } from "../../errors";
import { toCreateAdjustmentDocumentResult } from "../mappers";
import type { ReconciliationServiceContext } from "../shared/context";

export function createAdjustmentDocumentHandler(
  context: ReconciliationServiceContext,
) {
  const { db, documents, exceptionsRepo, idempotency } = context;

  return async function createAdjustmentDocument(
    input: CreateAdjustmentDocumentInput,
  ): Promise<CreateAdjustmentDocumentResult> {
    const validated = CreateAdjustmentDocumentInputSchema.parse(input);

    const result = await db.transaction(async (tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: RECONCILIATION_IDEMPOTENCY_SCOPE.CREATE_ADJUSTMENT_DOCUMENT,
        idempotencyKey: validated.idempotencyKey,
        request: validated,
        actorId: validated.actorUserId,
        serializeResult: (value: { exceptionId: string; documentId: string }) =>
          value,
        loadReplayResult: async ({ storedResult }) => ({
          exceptionId: validated.exceptionId,
          documentId: String(storedResult?.documentId ?? ""),
        }),
        handler: async () => {
          const exception = await exceptionsRepo.findByIdForUpdateTx(
            tx,
            validated.exceptionId,
          );

          if (!exception) {
            throw new ReconciliationExceptionNotFoundError(
              validated.exceptionId,
            );
          }

          const existingException = ReconciliationException.reconstitute(exception);
          const existingResolution = existingException.resolveWithAdjustment({
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

          const created = await documents.createDraft({
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
          await exceptionsRepo.markResolvedTx(tx, resolved.update!);

          return {
            exceptionId: resolved.exceptionId,
            documentId: resolved.documentId,
          };
        },
      }),
    );

    return toCreateAdjustmentDocumentResult(result);
  };
}
