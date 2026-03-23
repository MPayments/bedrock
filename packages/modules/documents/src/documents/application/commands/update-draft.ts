import type { ModuleRuntime } from "@bedrock/shared/core";

import type {
  DocumentRequestContext,
} from "../../../lifecycle/application/contracts/commands";
import {
  buildDocumentWithOperationId,
  loadDocumentOrThrow,
  loadDocumentWithOperationId,
} from "../../../lifecycle/application/shared/actions";
import {
  enforceDocumentPolicy,
  persistDocumentPolicyDenial,
} from "../../../lifecycle/application/shared/policy";
import type {
  DocumentActionPolicyService,
  DocumentRegistry,
} from "../../../plugins";
import type { DocumentsAccountingPeriodsPort } from "../../../posting/application/ports";
import { buildDocumentEventState } from "../../../shared/application/document-event-state";
import { DOCUMENTS_IDEMPOTENCY_SCOPE } from "../../../shared/application/documents-idempotency";
import { buildDefaultActionIdempotencyKey } from "../../../shared/application/idempotency-key";
import { mapDocumentDomainError } from "../../../shared/application/map-domain-error";
import {
  createModuleContext,
  resolveModuleForDocument,
} from "../../../shared/application/module-resolution";
import { DocumentDraftPlanner } from "../../domain/document-draft-planner";
import { collectDocumentOrganizationIds } from "../../domain/document-period-scope";
import type { DocumentWithOperationId } from "../contracts/dto";
import type { DocumentsCommandUnitOfWork } from "../ports";
import { validateInput } from "../validation";

export class UpdateDraftCommand {
  private readonly draftPlanner = new DocumentDraftPlanner();

  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DocumentsCommandUnitOfWork,
    private readonly accountingPeriods: DocumentsAccountingPeriodsPort,
    private readonly registry: DocumentRegistry,
    private readonly policy: DocumentActionPolicyService,
  ) {}

  async execute(input: {
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
      return await this.commandUow.run(
        async ({
          documentEvents,
          documentOperations,
          documentsCommand,
          idempotency,
          moduleRuntime,
        }) => {
          const currentNow = this.runtime.now();

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
                  registry: this.registry,
                },
              ),
            handler: async () => {
              const document = await loadDocumentOrThrow(documentsCommand, {
                documentId: input.documentId,
                docType: input.docType,
                forUpdate: true,
              });
              const module = resolveModuleForDocument(this.registry, document);
              const draftMetadata =
                this.draftPlanner.buildUpdateDraftMetadata(document);
              const moduleContext = createModuleContext({
                actorUserId: input.actorUserId,
                draft: draftMetadata,
                now: currentNow,
                log: this.runtime.log,
                operationIdempotencyKey: idempotencyKey,
                runtime: moduleRuntime,
              });
              const validatedUpdateInput = validateInput(
                module.updateSchema,
                input.payload,
                `${input.docType}.update`,
              );
              const currentOrganizationIds = collectDocumentOrganizationIds({
                payload: document.payload,
              });
              await this.accountingPeriods.assertOrganizationPeriodsOpen({
                occurredAt: document.occurredAt,
                organizationIds: currentOrganizationIds,
                docType: input.docType,
              });

              await module.canEdit(moduleContext, document);
              await enforceDocumentPolicy({
                policy: this.policy,
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
              const preview = this.draftPlanner.buildUpdatePreview({
                document,
                payload,
                occurredAt: nextOccurredAt,
                summary: updated.summary,
                now: currentNow,
              });
              const approvalStatus =
                (await this.policy.approvalMode({
                  module,
                  document: preview.document,
                  actorUserId: input.actorUserId,
                  moduleContext,
                })) === "maker_checker"
                  ? "pending"
                  : "not_required";
              const draftPlan = this.draftPlanner.finalizeUpdate({
                document,
                payload,
                occurredAt: nextOccurredAt,
                summary: updated.summary,
                now: currentNow,
                approvalStatus,
              });
              await this.accountingPeriods.assertOrganizationPeriodsOpen({
                occurredAt: nextOccurredAt,
                organizationIds: draftPlan.organizationIds,
                docType: input.docType,
              });

              const stored = await documentsCommand.updateDocument({
                documentId: document.id,
                docType: input.docType,
                patch: {
                  payload: draftPlan.document.payload,
                  occurredAt: draftPlan.document.occurredAt,
                  approvalStatus: draftPlan.document.approvalStatus,
                  title: draftPlan.document.title,
                  amountMinor: draftPlan.document.amountMinor,
                  currency: draftPlan.document.currency,
                  memo: draftPlan.document.memo,
                  counterpartyId: draftPlan.document.counterpartyId,
                  customerId: draftPlan.document.customerId,
                  organizationRequisiteId:
                    draftPlan.document.organizationRequisiteId,
                  searchText: draftPlan.document.searchText,
                  updatedAt: draftPlan.document.updatedAt,
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
                registry: this.registry,
                document: stored,
                postingOperationId: null,
              });
            },
          });
        },
      );
    } catch (error) {
      await persistDocumentPolicyDenial(this.commandUow, error);
      throw mapDocumentDomainError(error, {
        documentId: input.documentId,
        docType: input.docType,
      });
    }
  }
}
