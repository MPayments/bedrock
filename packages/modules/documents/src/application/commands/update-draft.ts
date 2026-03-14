import { validateInput } from "../../contracts/validation";
import { collectDocumentOrganizationIds } from "../../domain/accounting-periods";
import { buildDocumentEventState } from "../../domain/document-state";
import { buildSummary } from "../../domain/document-summary";
import { DOCUMENTS_IDEMPOTENCY_SCOPE } from "../../domain/idempotency";
import { isDocumentActionAllowed } from "../../domain/state-machine";
import { DocumentValidationError } from "../../errors";
import type { DocumentRequestContext, DocumentWithOperationId } from "../../types";
import {
  buildDocumentWithOperationId,
  loadDocumentOrThrow,
  loadDocumentWithOperationId,
} from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";
import { buildDefaultActionIdempotencyKey } from "../shared/idempotency-key";
import {
  createModuleContext,
  resolveModuleForDocument,
} from "../shared/module-resolution";
import {
  enforceDocumentPolicy,
  persistDocumentPolicyDenial,
} from "../shared/policy";

export function createUpdateDraftHandler(context: DocumentsServiceContext) {
  const { accountingPeriods, log, policy, registry, transactions } = context;

  return async function updateDraft(input: {
    docType: string;
    documentId: string;
    payload: unknown;
    actorUserId: string;
    idempotencyKey?: string;
    requestContext?: DocumentRequestContext;
  }): Promise<DocumentWithOperationId> {
    const idempotencyPayload =
      typeof input.payload === "object" && input.payload !== null
        ? (input.payload as Record<string, unknown>)
        : { value: input.payload };
    const idempotencyKey =
      input.idempotencyKey ??
      buildDefaultActionIdempotencyKey("documents.updateDraft", {
        docType: input.docType,
        documentId: input.documentId,
        actorUserId: input.actorUserId,
        payload: idempotencyPayload,
      });

    try {
      return await transactions.withTransaction(
        async ({ idempotency, moduleDb, repository }) => {
          const moduleContext = createModuleContext({
            db: moduleDb,
            actorUserId: input.actorUserId,
            now: new Date(),
            log,
            operationIdempotencyKey: idempotencyKey,
          });

          return idempotency.withIdempotency({
            scope: DOCUMENTS_IDEMPOTENCY_SCOPE.UPDATE_DRAFT,
            idempotencyKey,
            request: {
              docType: input.docType,
              documentId: input.documentId,
              actorUserId: input.actorUserId,
              payload: idempotencyPayload,
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
              loadDocumentWithOperationId(repository, {
                docType: input.docType,
                documentId: String(storedResult?.documentId ?? input.documentId),
                postingOperationId: null,
                registry,
              }),
            handler: async () => {
              const document = await loadDocumentOrThrow(repository, {
                documentId: input.documentId,
                docType: input.docType,
                forUpdate: true,
              });
              const module = resolveModuleForDocument(registry, document);
              const validatedUpdateInput = validateInput(
                module.updateSchema,
                input.payload,
                `${input.docType}.update`,
              );

              if (
                !isDocumentActionAllowed({
                  action: "edit",
                  document,
                  module: {
                    postingRequired: module.postingRequired,
                    allowDirectPostFromDraft: module.allowDirectPostFromDraft,
                  },
                })
              ) {
                throw new DocumentValidationError(
                  "Only active draft documents can be updated",
                );
              }
              const currentOrganizationIds = collectDocumentOrganizationIds({
                payload: document.payload,
              });
              await accountingPeriods.assertOrganizationPeriodsOpen({
                occurredAt: document.occurredAt,
                organizationIds: currentOrganizationIds,
                docType: input.docType,
              });

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
              const nextOccurredAt = updated.occurredAt ?? document.occurredAt;

              const next = {
                ...document,
                payload,
                occurredAt: nextOccurredAt,
              };
              const approvalStatus = module.approvalRequired(next)
                ? "pending"
                : "not_required";
              const summary = buildSummary(
                module.deriveSummary({ ...next, approvalStatus }),
              );
              const nextOrganizationIds = collectDocumentOrganizationIds({
                payload,
              });
              await accountingPeriods.assertOrganizationPeriodsOpen({
                occurredAt: nextOccurredAt,
                organizationIds: nextOrganizationIds,
                docType: input.docType,
              });

              const stored = await repository.updateDocument({
                documentId: document.id,
                docType: input.docType,
                patch: {
                  payload,
                  occurredAt: nextOccurredAt,
                  approvalStatus,
                  title: summary.title,
                  amountMinor: summary.amountMinor,
                  currency: summary.currency,
                  memo: summary.memo,
                  counterpartyId: summary.counterpartyId,
                  customerId: summary.customerId,
                  organizationRequisiteId: summary.organizationRequisiteId,
                  searchText: summary.searchText,
                },
              });

              if (!stored) {
                throw new Error("Failed to update document draft");
              }

              await repository.insertDocumentEvent({
                documentId: document.id,
                eventType: "update",
                actorId: input.actorUserId,
                requestId: input.requestContext?.requestId,
                correlationId: input.requestContext?.correlationId,
                traceId: input.requestContext?.traceId,
                causationId: input.requestContext?.causationId,
                before,
                after: buildDocumentEventState(stored),
              });

              return buildDocumentWithOperationId({
                registry,
                document: stored,
                postingOperationId: null,
              });
            },
          });
        },
      );
    } catch (error) {
      await persistDocumentPolicyDenial(transactions, error);
      throw error;
    }
  };
}
