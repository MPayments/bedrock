import { and, eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/idempotency";

import { DocumentValidationError } from "../errors";
import type { DocumentsServiceContext } from "../internal/context";
import {
  buildDefaultActionIdempotencyKey,
  buildDocumentEventState,
  buildSummary,
  createModuleContext,
  insertDocumentEvent,
  lockDocument,
  loadDocumentWithOperationId,
  resolveModule,
} from "../internal/helpers";
import {
  enforceDocumentPolicy,
  persistDocumentPolicyDenial,
} from "../internal/policy";
import type { DocumentRequestContext, DocumentWithOperationId } from "../types";
import { validateInput } from "../validation";

export function createUpdateDraftHandler(context: DocumentsServiceContext) {
  const { db, idempotency, log, policy, registry } = context;

  return async function updateDraft(input: {
    docType: string;
    documentId: string;
    payload: unknown;
    actorUserId: string;
    idempotencyKey?: string;
    requestContext?: DocumentRequestContext;
  }): Promise<DocumentWithOperationId> {
    const module = resolveModule(registry, input.docType);
    const validatedUpdateInput = validateInput(
      module.updateSchema,
      input.payload,
      `${input.docType}.update`,
    );
    const idempotencyKey =
      input.idempotencyKey ??
      buildDefaultActionIdempotencyKey("documents.updateDraft", {
        docType: input.docType,
        documentId: input.documentId,
        actorUserId: input.actorUserId,
        payload: validatedUpdateInput as Record<string, unknown>,
      });

    try {
      return await db.transaction(async (tx) => {
        const moduleContext = createModuleContext({
          db: tx,
          actorUserId: input.actorUserId,
          now: new Date(),
          log,
        });

        return idempotency.withIdempotencyTx({
          tx,
          scope: IDEMPOTENCY_SCOPE.DOCUMENTS_UPDATE_DRAFT,
          idempotencyKey,
          request: {
            docType: input.docType,
            documentId: input.documentId,
            actorUserId: input.actorUserId,
            payload: validatedUpdateInput,
          },
          actorId: input.actorUserId,
          serializeResult: (result: DocumentWithOperationId) => ({
            documentId: result.document.id,
          }),
          loadReplayResult: async ({
            storedResult,
          }: {
            storedResult: { documentId?: string } | null;
          }) =>
            loadDocumentWithOperationId(
              tx,
              input.docType,
              String(storedResult?.documentId ?? input.documentId),
              null,
            ),
          handler: async () => {
            const document = await lockDocument(tx, input.documentId, input.docType);

            if (
              document.submissionStatus !== "draft" ||
              document.lifecycleStatus !== "active"
            ) {
              throw new DocumentValidationError(
                "Only active draft documents can be updated",
              );
            }

            await module.canEdit(moduleContext, document);
            await enforceDocumentPolicy({
              policy,
              action: "edit",
              module,
              actorUserId: input.actorUserId,
              moduleContext,
              document,
              requestContext: input.requestContext,
            });

            const before = buildDocumentEventState(document);
            const updated = await module.updateDraft(
              moduleContext,
              document,
              validatedUpdateInput,
            );
            const payload = validateInput(
              module.payloadSchema,
              updated.payload,
              `${input.docType}.payload`,
            );

            const next = {
              ...document,
              payload,
              occurredAt: updated.occurredAt ?? document.occurredAt,
            };
            const approvalStatus = module.approvalRequired(next)
              ? "pending"
              : "not_required";
            const summary = buildSummary(
              module.deriveSummary({ ...next, approvalStatus }),
            );

            const [stored] = await tx
              .update(schema.documents)
              .set({
                payload,
                occurredAt: updated.occurredAt ?? document.occurredAt,
                approvalStatus,
                title: summary.title,
                amountMinor: summary.amountMinor,
                currency: summary.currency,
                memo: summary.memo,
                counterpartyId: summary.counterpartyId,
                customerId: summary.customerId,
                operationalAccountId: summary.operationalAccountId,
                searchText: summary.searchText,
                updatedAt: sql`now()`,
                version: sql`${schema.documents.version} + 1`,
              })
              .where(
                and(
                  eq(schema.documents.id, document.id),
                  eq(schema.documents.docType, input.docType),
                ),
              )
              .returning();

            await insertDocumentEvent(tx, {
              documentId: document.id,
              eventType: "update",
              actorId: input.actorUserId,
              requestId: input.requestContext?.requestId,
              correlationId: input.requestContext?.correlationId,
              traceId: input.requestContext?.traceId,
              causationId: input.requestContext?.causationId,
              before,
              after: buildDocumentEventState(stored!),
            });

            return { document: stored!, postingOperationId: null };
          },
        });
      });
    } catch (error) {
      await persistDocumentPolicyDenial(db, error);
      throw error;
    }
  };
}
