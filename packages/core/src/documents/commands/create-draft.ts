import { schema, type Document } from "@bedrock/core/documents/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/core/idempotency";
import type { Transaction } from "@bedrock/kernel/db/types";

import { isSystemOnlyDocumentType } from "../doc-type-rules";
import { DocumentValidationError } from "../errors";
import type { DocumentsServiceContext } from "../internal/context";
import {
  buildDocumentEventState,
  buildSummary,
  createDocumentInsertBase,
  createModuleContext,
  getDocumentByCreateIdempotencyKey,
  loadDocumentWithOperationId,
  insertDocumentEvent,
  insertInitialLinks,
  resolveDocumentModuleIdentity,
  resolveModule,
} from "../internal/helpers";
import {
  enforceDocumentPolicy,
  persistDocumentPolicyDenial,
} from "../internal/policy";
import {
  assertCounterpartyPeriodsOpen,
  closeCounterpartyPeriod,
  collectDocumentCounterpartyIds,
  reopenCounterpartyPeriod,
} from "../period-locks";
import type { DocumentRequestContext, DocumentWithOperationId } from "../types";
import { validateInput } from "../validation";

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
  const { db, idempotency, log, policy, registry } = context;

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
      return await db.transaction(async (tx: Transaction) => {
        const moduleContext = createModuleContext({
          db: tx,
          actorUserId: input.actorUserId,
          now: new Date(),
          log,
        });
        const { moduleId, moduleVersion } = resolveDocumentModuleIdentity(module);

        return idempotency.withIdempotencyTx({
          tx,
          scope: IDEMPOTENCY_SCOPE.DOCUMENTS_CREATE_DRAFT,
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
              (await getDocumentByCreateIdempotencyKey(
                tx,
                input.docType,
                input.createIdempotencyKey,
              )) ?? null;
            if (!replay) {
              throw new Error("Document replay is missing for createDraft");
            }

            return {
              document: replay,
              postingOperationId: null,
            };
          },
          handler: async () => {
            const replay = await getDocumentByCreateIdempotencyKey(
              tx,
              input.docType,
              input.createIdempotencyKey,
            );
            if (replay) {
              return loadDocumentWithOperationId(
                tx,
                input.docType,
                replay.id,
                null,
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
            const counterpartyIds = collectDocumentCounterpartyIds({
              summaryCounterpartyId: summary.counterpartyId,
              payload,
            });

            if (!isSystemOnlyDocumentType(input.docType)) {
              await assertCounterpartyPeriodsOpen({
                db: tx,
                occurredAt: draft.occurredAt,
                counterpartyIds,
                docType: input.docType,
              });
            }

            const values = {
              ...transient,
              ...summary,
            };

            const [inserted] = await tx
              .insert(schema.documents)
              .values(values)
              .onConflictDoNothing()
              .returning();

            const document =
              inserted ??
              (await getDocumentByCreateIdempotencyKey(
                tx,
                input.docType,
                input.createIdempotencyKey,
              ));

            if (!document) {
              throw new Error("Failed to create document draft");
            }

            const links = await module.buildInitialLinks?.(
              moduleContext,
              document,
            );
            if (links && links.length > 0) {
              await insertInitialLinks(tx, document, links);
            }

            if (document.docType === "period_close") {
              const counterpartyId = readPayloadString(payload, "counterpartyId");
              if (!counterpartyId) {
                throw new DocumentValidationError(
                  "period_close payload requires counterpartyId",
                );
              }
              await closeCounterpartyPeriod({
                db: tx,
                counterpartyId,
                periodStart: readPayloadDate(payload, "periodStart", document.occurredAt),
                periodEnd: readPayloadDate(payload, "periodEnd", document.occurredAt),
                closedBy: input.actorUserId,
                closeReason: readPayloadString(payload, "closeReason"),
                lockedByDocumentId: document.id,
              });
            } else if (document.docType === "period_reopen") {
              const counterpartyId = readPayloadString(payload, "counterpartyId");
              if (!counterpartyId) {
                throw new DocumentValidationError(
                  "period_reopen payload requires counterpartyId",
                );
              }
              await reopenCounterpartyPeriod({
                db: tx,
                counterpartyId,
                periodStart: readPayloadDate(payload, "periodStart", document.occurredAt),
                reopenedBy: input.actorUserId,
                reopenReason: readPayloadString(payload, "reopenReason"),
              });
            }

            await insertDocumentEvent(tx, {
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

            return { document, postingOperationId: null };
          },
        });
      });
    } catch (error) {
      await persistDocumentPolicyDenial(db, error);
      throw error;
    }
  };
}
