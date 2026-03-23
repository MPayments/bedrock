import type {
  DocumentsModule,
} from "@bedrock/documents";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import {
  CreateAdjustmentDocumentInputSchema,
  type CreateAdjustmentDocumentInput,
  type CreateAdjustmentDocumentResult,
} from "@bedrock/reconciliation/contracts";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";

export interface ReconciliationAdjustmentsDocumentsModule {
  documents: {
    commands: Pick<DocumentsModule["documents"]["commands"], "createDraft">;
  };
}

export type CreateReconciliationAdjustmentDocumentsModule = (
  tx: Transaction,
) => ReconciliationAdjustmentsDocumentsModule;

export type CreateReconciliationAdjustmentReconciliationService = (
  tx: Transaction,
) => {
  exceptions: {
    getAdjustmentResolution(exceptionId: string): Promise<{
      exceptionId: string;
      documentId: string;
      alreadyResolved: boolean;
    }>;
    resolveWithAdjustment(input: {
      exceptionId: string;
      adjustmentDocumentId: string;
    }): Promise<{
      exceptionId: string;
      documentId: string;
      alreadyResolved: boolean;
    }>;
  };
};

export interface ReconciliationAdjustmentsWorkflowDeps {
  db: Database;
  idempotency: IdempotencyPort;
  createDocumentsModule: CreateReconciliationAdjustmentDocumentsModule;
  createReconciliationService: CreateReconciliationAdjustmentReconciliationService;
}

export interface ReconciliationAdjustmentsWorkflow {
  createAdjustmentDocument(
    input: CreateAdjustmentDocumentInput,
  ): Promise<CreateAdjustmentDocumentResult>;
}

export function createReconciliationAdjustmentsWorkflow(
  deps: ReconciliationAdjustmentsWorkflowDeps,
): ReconciliationAdjustmentsWorkflow {
  return {
    async createAdjustmentDocument(
      input: CreateAdjustmentDocumentInput,
    ): Promise<CreateAdjustmentDocumentResult> {
      const validated = CreateAdjustmentDocumentInputSchema.parse(input);

      return deps.db.transaction(async (tx) => {
        const documentsModule = deps.createDocumentsModule(tx);
        const reconciliation = deps.createReconciliationService(tx);

        return deps.idempotency.withIdempotencyTx({
          tx,
          scope: "recon.createAdjustmentDocument",
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
            const resolution =
              await reconciliation.exceptions.getAdjustmentResolution(
                validated.exceptionId,
              );
            if (resolution.alreadyResolved) {
              return {
                exceptionId: resolution.exceptionId,
                documentId: resolution.documentId,
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

            const created = await documentsModule.documents.commands.createDraft({
              docType: validated.docType,
              createIdempotencyKey,
              payload: validated.payload,
              actorUserId: validated.actorUserId,
              requestContext: validated.requestContext,
            });

            const resolved =
              await reconciliation.exceptions.resolveWithAdjustment({
                exceptionId: validated.exceptionId,
                adjustmentDocumentId: created.document.id,
              });

            return {
              exceptionId: resolved.exceptionId,
              documentId: resolved.documentId,
            };
          },
        });
      });
    },
  };
}
