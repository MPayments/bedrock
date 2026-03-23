import type { ModuleRuntime } from "@bedrock/shared/core";

import type { DocumentRequestContext } from "../../../lifecycle/application/contracts/commands";
import {
  buildDocumentWithOperationId,
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
import { mapDocumentDomainError } from "../../../shared/application/map-domain-error";
import {
  createModuleContext,
  resolveDocumentModuleIdentity,
  resolveModule,
} from "../../../shared/application/module-resolution";
import { isSystemOnlyDocumentType } from "../../domain/doc-type";
import { DocumentDraftPlanner } from "../../domain/document-draft-planner";
import type { DocumentWithOperationId } from "../contracts/dto";
import type { DocumentsCommandUnitOfWork } from "../ports";
import { validateInput } from "../validation";

export class CreateDraftCommand {
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
    createIdempotencyKey: string;
    payload: unknown;
    actorUserId: string;
    requestContext?: DocumentRequestContext;
  }) {
    const module = resolveModule(this.registry, input.docType);
    const validatedCreateInput = validateInput(
      module.createSchema,
      input.payload,
      `${input.docType}.create`,
    );

    try {
      return await this.commandUow.run(
        async ({
          documentEvents,
          documentLinks,
          documentOperations,
          documentsCommand,
          idempotency,
          moduleRuntime,
        }) => {
          const currentNow = this.runtime.now();
          const { moduleId, moduleVersion } =
            resolveDocumentModuleIdentity(module);

          return idempotency.withIdempotency({
            scope: DOCUMENTS_IDEMPOTENCY_SCOPE.CREATE_DRAFT,
            idempotencyKey: input.createIdempotencyKey,
            request: {
              docType: input.docType,
              createIdempotencyKey: input.createIdempotencyKey,
              actorUserId: input.actorUserId,
              payload: validatedCreateInput,
            },
            actorId: input.actorUserId,
            serializeResult: (result: DocumentWithOperationId) => ({
              documentId: result.document.id,
            }),
            loadReplayResult: async () => {
              const replay =
                await documentsCommand.findDocumentByCreateIdempotencyKey({
                  docType: input.docType,
                  createIdempotencyKey: input.createIdempotencyKey,
                });
              if (!replay) {
                throw new Error("Document replay is missing for createDraft");
              }

              return buildDocumentWithOperationId({
                registry: this.registry,
                document: replay,
                postingOperationId: null,
              });
            },
            handler: async () => {
              const replay =
                await documentsCommand.findDocumentByCreateIdempotencyKey({
                  docType: input.docType,
                  createIdempotencyKey: input.createIdempotencyKey,
                });
              if (replay) {
                return loadDocumentWithOperationId(
                  {
                    documents: documentsCommand,
                    documentOperations,
                  },
                  {
                    docType: input.docType,
                    documentId: replay.id,
                    postingOperationId: null,
                    registry: this.registry,
                  },
                );
              }

              const draftMetadata = this.draftPlanner.buildCreateDraftMetadata({
                id: this.runtime.generateUuid(),
                docType: module.docType,
                docNoPrefix: module.docNoPrefix,
                moduleId,
                moduleVersion,
                payloadVersion: module.payloadVersion,
              });
              const moduleContext = createModuleContext({
                actorUserId: input.actorUserId,
                draft: draftMetadata,
                now: currentNow,
                log: this.runtime.log,
                operationIdempotencyKey: input.createIdempotencyKey,
                runtime: moduleRuntime,
              });

              await module.canCreate(moduleContext, validatedCreateInput);
              await enforceDocumentPolicy({
                policy: this.policy,
                action: "create",
                module,
                actorUserId: input.actorUserId,
                moduleContext,
                payload: validatedCreateInput,
                requestContext: input.requestContext,
              });

              const draft = await module.createDraft(
                moduleContext,
                validatedCreateInput,
              );
              const payload = validateInput(
                module.payloadSchema,
                draft.payload,
                `${input.docType}.payload`,
              );
              const preview = this.draftPlanner.buildCreatePreview({
                draft: draftMetadata,
                payload,
                occurredAt: draft.occurredAt,
                createIdempotencyKey: input.createIdempotencyKey,
                createdBy: input.actorUserId,
                summary: draft.summary,
                now: currentNow,
                postingRequired: module.postingRequired,
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
              const draftPlan = this.draftPlanner.finalizeCreate({
                draft: draftMetadata,
                payload,
                occurredAt: draft.occurredAt,
                createIdempotencyKey: input.createIdempotencyKey,
                createdBy: input.actorUserId,
                summary: draft.summary,
                now: currentNow,
                approvalStatus,
                postingRequired: module.postingRequired,
              });

              if (!isSystemOnlyDocumentType(input.docType)) {
                await this.accountingPeriods.assertOrganizationPeriodsOpen({
                  occurredAt: draft.occurredAt,
                  organizationIds: draftPlan.organizationIds,
                  docType: input.docType,
                });
              }

              const document =
                (await documentsCommand.insertDocument(draftPlan.document)) ??
                (await documentsCommand.findDocumentByCreateIdempotencyKey({
                  docType: input.docType,
                  createIdempotencyKey: input.createIdempotencyKey,
                }));

              if (!document) {
                throw new Error("Failed to create document draft");
              }

              const links = await module.buildInitialLinks?.(
                moduleContext,
                document,
              );
              if (links && links.length > 0) {
                await documentLinks.insertInitialLinks({ document, links });
              }

              await documentEvents.insertDocumentEvent({
                documentId: document.id,
                eventType: "create",
                actorId: input.actorUserId,
                requestId: input.requestContext?.requestId,
                correlationId: input.requestContext?.correlationId,
                traceId: input.requestContext?.traceId,
                causationId: input.requestContext?.causationId,
                before: null,
                after: buildDocumentEventState(document),
              });

              return buildDocumentWithOperationId({
                registry: this.registry,
                document,
                postingOperationId: null,
              });
            },
          });
        },
      );
    } catch (error) {
      await persistDocumentPolicyDenial(this.commandUow, error);
      throw mapDocumentDomainError(error);
    }
  }
}
