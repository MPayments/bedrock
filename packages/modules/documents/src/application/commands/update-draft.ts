import type {
  DocumentRequestContext,
  DocumentWithOperationId,
} from "../../contracts/service";
import { validateInput } from "../../contracts/validation";
import { collectDocumentOrganizationIds } from "../../domain/document-period-scope";
import { DocumentAggregate } from "../../domain/document";
import {
  buildDocumentWithOperationId,
  loadDocumentOrThrow,
  loadDocumentWithOperationId,
} from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";
import { buildDocumentEventState } from "../shared/document-event-state";
import { DOCUMENTS_IDEMPOTENCY_SCOPE } from "../shared/documents-idempotency";
import { buildDefaultActionIdempotencyKey } from "../shared/idempotency-key";
import { mapDocumentDomainError } from "../shared/map-domain-error";
import {
  createModuleContext,
  resolveModuleForDocument,
} from "../shared/module-resolution";
import {
  enforceDocumentPolicy,
  persistDocumentPolicyDenial,
} from "../shared/policy";

export function createUpdateDraftHandler(context: DocumentsServiceContext) {
  const { accountingPeriods, log, now, policy, registry, transactions } = context;

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
        async ({
          documentEvents,
          documentOperations,
          documentsCommand,
          idempotency,
          moduleRuntime,
        }) => {
          const currentNow = now();
          const moduleContext = createModuleContext({
            actorUserId: input.actorUserId,
            now: currentNow,
            log,
            operationIdempotencyKey: idempotencyKey,
            runtime: moduleRuntime,
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
            loadReplayResult: async ({ storedResult }) =>
              loadDocumentWithOperationId(
                {
                  documents: documentsCommand,
                  documentOperations,
                },
                {
                  docType: input.docType,
                  documentId: String(
                    storedResult?.documentId ?? input.documentId,
                  ),
                  postingOperationId: null,
                  registry,
                },
              ),
            handler: async () => {
              const document = await loadDocumentOrThrow(documentsCommand, {
                documentId: input.documentId,
                docType: input.docType,
                forUpdate: true,
              });
              const aggregate = DocumentAggregate.reconstitute(document);
              const module = resolveModuleForDocument(registry, document);
              const validatedUpdateInput = validateInput(
                module.updateSchema,
                input.payload,
                `${input.docType}.update`,
              );
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
              const summary = module.deriveSummary({ ...next, approvalStatus });
              const nextOrganizationIds = collectDocumentOrganizationIds({
                payload,
              });
              await accountingPeriods.assertOrganizationPeriodsOpen({
                occurredAt: nextOccurredAt,
                organizationIds: nextOrganizationIds,
                docType: input.docType,
              });

              const nextDocument = aggregate.updateDraft({
                payload,
                occurredAt: nextOccurredAt,
                approvalStatus,
                summary,
                now: currentNow,
              }).toSnapshot();

              const stored = await documentsCommand.updateDocument({
                documentId: document.id,
                docType: input.docType,
                patch: {
                  payload: nextDocument.payload,
                  occurredAt: nextDocument.occurredAt,
                  approvalStatus: nextDocument.approvalStatus,
                  title: nextDocument.title,
                  amountMinor: nextDocument.amountMinor,
                  currency: nextDocument.currency,
                  memo: nextDocument.memo,
                  counterpartyId: nextDocument.counterpartyId,
                  customerId: nextDocument.customerId,
                  organizationRequisiteId: nextDocument.organizationRequisiteId,
                  searchText: nextDocument.searchText,
                  updatedAt: nextDocument.updatedAt,
                },
              });

              if (!stored) {
                throw new Error("Failed to update document draft");
              }

              await documentEvents.insertDocumentEvent({
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
      throw mapDocumentDomainError(error, {
        documentId: input.documentId,
        docType: input.docType,
      });
    }
  };
}
