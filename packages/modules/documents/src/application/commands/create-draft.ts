import { randomUUID } from "node:crypto";

import type {
  DocumentRequestContext,
  DocumentWithOperationId,
} from "../../contracts";
import { isSystemOnlyDocumentType } from "../../domain/doc-type";
import { buildDocNo } from "../../domain/document";
import { DocumentAggregate, type Document } from "../../domain/document";
import { collectDocumentOrganizationIds } from "../../domain/document-period-scope";
import { buildSummary } from "../../domain/document-summary";
import { validateInput } from "../../validation";
import {
  buildDocumentWithOperationId,
  loadDocumentWithOperationId,
} from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";
import { buildDocumentEventState } from "../shared/document-event-state";
import { DOCUMENTS_IDEMPOTENCY_SCOPE } from "../shared/documents-idempotency";
import { mapDocumentDomainError } from "../shared/map-domain-error";
import {
  createModuleContext,
  resolveDocumentModuleIdentity,
  resolveModule,
} from "../shared/module-resolution";
import {
  enforceDocumentPolicy,
  persistDocumentPolicyDenial,
} from "../shared/policy";

export function createCreateDraftHandler(context: DocumentsServiceContext) {
  const { accountingPeriods, log, now, policy, registry, transactions } =
    context;

  return async function createDraft(input: {
    docType: string;
    createIdempotencyKey: string;
    dealId?: string;
    payload: unknown;
    actorUserId: string;
    requestContext?: DocumentRequestContext;
  }): Promise<DocumentWithOperationId> {
    const module = resolveModule(registry, input.docType);
    const validatedCreateInput = validateInput(
      module.createSchema,
      input.payload,
      `${input.docType}.create`,
    );

    try {
      return await transactions.withTransaction(
        async ({
          documentEvents,
          documentBusinessLinks,
          documentLinks,
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
            operationIdempotencyKey: input.createIdempotencyKey,
            runtime: moduleRuntime,
          });
          const { moduleId, moduleVersion } =
            resolveDocumentModuleIdentity(module);

          return idempotency.withIdempotency({
            scope: DOCUMENTS_IDEMPOTENCY_SCOPE.CREATE_DRAFT,
            idempotencyKey: input.createIdempotencyKey,
            request: {
              docType: input.docType,
              createIdempotencyKey: input.createIdempotencyKey,
              dealId: input.dealId ?? null,
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
                registry,
                document: replay,
                dealId:
                  input.dealId ??
                  (await documentBusinessLinks.findDealIdByDocumentId(replay.id)),
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
                    documentBusinessLinks,
                    documents: documentsCommand,
                    documentOperations,
                  },
                  {
                    docType: input.docType,
                    documentId: replay.id,
                    dealId:
                      input.dealId ??
                      (await documentBusinessLinks.findDealIdByDocumentId(
                        replay.id,
                      )),
                    postingOperationId: null,
                    registry,
                  },
                );
              }

              await module.canCreate(moduleContext, validatedCreateInput);
              await enforceDocumentPolicy({
                policy,
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
              const documentId = randomUUID();
              const postingStatus = module.postingRequired
                ? "unposted"
                : "not_required";
              const draftCandidate: Document = {
                id: documentId,
                docType: module.docType,
                docNo: buildDocNo(module.docNoPrefix, documentId),
                moduleId,
                moduleVersion,
                payloadVersion: module.payloadVersion,
                payload,
                title: "",
                occurredAt: draft.occurredAt,
                submissionStatus: "draft",
                approvalStatus: "not_required",
                postingStatus,
                lifecycleStatus: "active",
                createIdempotencyKey: input.createIdempotencyKey,
                amountMinor: null,
                currency: null,
                memo: null,
                counterpartyId: null,
                customerId: null,
                organizationRequisiteId: null,
                searchText: "",
                createdBy: input.actorUserId,
                submittedBy: null,
                submittedAt: null,
                approvedBy: null,
                approvedAt: null,
                rejectedBy: null,
                rejectedAt: null,
                cancelledBy: null,
                cancelledAt: null,
                postingStartedAt: null,
                postedAt: null,
                postingError: null,
                createdAt: currentNow,
                updatedAt: currentNow,
                version: 1,
              };
              const previewSummary = buildSummary(
                module.deriveSummary(draftCandidate),
              );
              const approvalCandidate = {
                ...draftCandidate,
                ...previewSummary,
              };
              const approvalStatus =
                (await policy.approvalMode({
                  module,
                  document: approvalCandidate,
                  actorUserId: input.actorUserId,
                  moduleContext,
                })) === "maker_checker"
                  ? "pending"
                  : "not_required";
              const summary = module.deriveSummary({
                ...approvalCandidate,
                approvalStatus,
              });
              const organizationIds = collectDocumentOrganizationIds({
                payload,
              });

              if (!isSystemOnlyDocumentType(input.docType)) {
                await accountingPeriods.assertOrganizationPeriodsOpen({
                  occurredAt: draft.occurredAt,
                  organizationIds,
                  docType: input.docType,
                });
              }

              const draftDocument = DocumentAggregate.createDraft({
                id: documentId,
                docType: module.docType,
                docNoPrefix: module.docNoPrefix,
                moduleId,
                moduleVersion,
                payloadVersion: module.payloadVersion,
                payload,
                occurredAt: draft.occurredAt,
                createIdempotencyKey: input.createIdempotencyKey,
                createdBy: input.actorUserId,
                approvalStatus,
                postingStatus,
                summary,
                now: currentNow,
              }).toSnapshot();

              const document =
                (await documentsCommand.insertDocument(draftDocument)) ??
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

              if (input.dealId) {
                await documentBusinessLinks.insertDealLink({
                  dealId: input.dealId,
                  documentId: document.id,
                  linkKind: input.docType,
                });
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
                registry,
                document,
                dealId:
                  input.dealId ??
                  (await documentBusinessLinks.findDealIdByDocumentId(
                    document.id,
                  )),
                postingOperationId: null,
              });
            },
          });
        },
      );
    } catch (error) {
      await persistDocumentPolicyDenial(transactions, error);
      throw mapDocumentDomainError(error);
    }
  };
}
