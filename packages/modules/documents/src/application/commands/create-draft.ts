import { validateInput } from "../../contracts/validation";
import { collectDocumentOrganizationIds } from "../../domain/accounting-periods";
import { isSystemOnlyDocumentType } from "../../domain/doc-type-rules";
import { buildDocumentEventState } from "../../domain/document-state";
import { buildSummary } from "../../domain/document-summary";
import { DOCUMENTS_IDEMPOTENCY_SCOPE } from "../../domain/idempotency";
import type { Document } from "../../domain/types";
import { DocumentValidationError } from "../../errors";
import type { DocumentRequestContext, DocumentWithOperationId } from "../../types";
import {
  buildDocumentWithOperationId,
  loadDocumentWithOperationId,
} from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";
import { createDocumentInsertBase } from "../shared/document-record";
import {
  createModuleContext,
  resolveDocumentModuleIdentity,
  resolveModule,
} from "../shared/module-resolution";
import {
  enforceDocumentPolicy,
  persistDocumentPolicyDenial,
} from "../shared/policy";

function readPayloadString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readPayloadDate(
  payload: Record<string, unknown>,
  key: string,
  fallback: Date,
): Date {
  const raw = payload[key];
  if (typeof raw === "string" || raw instanceof Date) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }

  return fallback;
}

export function createCreateDraftHandler(context: DocumentsServiceContext) {
  const { accountingPeriods, log, policy, registry, transactions } = context;

  return async function createDraft(input: {
    docType: string;
    createIdempotencyKey: string;
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
        async ({ idempotency, moduleDb, repository }) => {
          const moduleContext = createModuleContext({
            db: moduleDb,
            actorUserId: input.actorUserId,
            now: new Date(),
            log,
            operationIdempotencyKey: input.createIdempotencyKey,
          });
          const { moduleId, moduleVersion } = resolveDocumentModuleIdentity(module);

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
            loadReplayResult: async ({
              storedResult: _storedResult,
            }: {
              storedResult: { documentId?: string } | null;
            }) => {
              const replay =
                (await repository.findDocumentByCreateIdempotencyKey({
                  docType: input.docType,
                  createIdempotencyKey: input.createIdempotencyKey,
                })) ?? null;
              if (!replay) {
                throw new Error("Document replay is missing for createDraft");
              }

              return buildDocumentWithOperationId({
                registry,
                document: replay,
                postingOperationId: null,
              });
            },
            handler: async () => {
              const replay = await repository.findDocumentByCreateIdempotencyKey({
                docType: input.docType,
                createIdempotencyKey: input.createIdempotencyKey,
              });
              if (replay) {
                return loadDocumentWithOperationId(repository, {
                  docType: input.docType,
                  documentId: replay.id,
                  postingOperationId: null,
                  registry,
                });
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

              const base = createDocumentInsertBase({
                docType: module.docType,
                docNoPrefix: module.docNoPrefix,
                moduleId,
                moduleVersion,
                payloadVersion: module.payloadVersion,
                payload,
                occurredAt: draft.occurredAt,
                createIdempotencyKey: input.createIdempotencyKey,
                createdBy: input.actorUserId,
                approvalStatus: "not_required",
                postingStatus: module.postingRequired ? "unposted" : "not_required",
              });

              const transient: Document = {
                ...base,
                approvalStatus: module.approvalRequired(base)
                  ? "pending"
                  : "not_required",
              };
              const summary = buildSummary(module.deriveSummary(transient));
              const organizationIds = collectDocumentOrganizationIds({ payload });

              if (!isSystemOnlyDocumentType(input.docType)) {
                await accountingPeriods.assertOrganizationPeriodsOpen({
                  occurredAt: draft.occurredAt,
                  organizationIds,
                  docType: input.docType,
                });
              }

              const document =
                (await repository.insertDocument({
                  ...transient,
                  ...summary,
                })) ??
                (await repository.findDocumentByCreateIdempotencyKey({
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
                await repository.insertInitialLinks({ document, links });
              }

              if (document.docType === "period_close") {
                const organizationId = readPayloadString(payload, "organizationId");
                if (!organizationId) {
                  throw new DocumentValidationError(
                    "period_close payload requires organizationId",
                  );
                }
                await accountingPeriods.closePeriod({
                  organizationId,
                  periodStart: readPayloadDate(
                    payload,
                    "periodStart",
                    document.occurredAt,
                  ),
                  periodEnd: readPayloadDate(
                    payload,
                    "periodEnd",
                    document.occurredAt,
                  ),
                  closedBy: input.actorUserId,
                  closeReason: readPayloadString(payload, "closeReason"),
                  closeDocumentId: document.id,
                });
              } else if (document.docType === "period_reopen") {
                const organizationId = readPayloadString(payload, "organizationId");
                if (!organizationId) {
                  throw new DocumentValidationError(
                    "period_reopen payload requires organizationId",
                  );
                }
                await accountingPeriods.reopenPeriod({
                  organizationId,
                  periodStart: readPayloadDate(
                    payload,
                    "periodStart",
                    document.occurredAt,
                  ),
                  reopenedBy: input.actorUserId,
                  reopenReason: readPayloadString(payload, "reopenReason"),
                  reopenDocumentId: document.id,
                });
              }

              await repository.insertDocumentEvent({
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
