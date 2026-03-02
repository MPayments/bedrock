import { and, desc, eq, inArray } from "drizzle-orm";

import { schema as documentsSchema } from "@bedrock/db/schema/documents";
import { schema as ledgerSchema } from "@bedrock/db/schema/ledger";
import {
  schema as reconciliationSchema,
  type ReconciliationException,
  type ReconciliationExternalRecord,
  type ReconciliationMatchStatus,
} from "@bedrock/db/schema/reconciliation";
import type { Database, Transaction } from "@bedrock/db/types";
import {
  canonicalJson,
  sha256Hex,
  type CorrelationContext,
} from "@bedrock/foundation/kernel";
import { IDEMPOTENCY_SCOPE } from "@bedrock/platform/idempotency";

import {
  ExternalRecordConflictError,
  ReconciliationExceptionNotFoundError,
  ReconciliationMatchNotFoundError,
} from "./errors";
import {
  createReconciliationServiceContext,
  type ReconciliationServiceDeps,
} from "./internal/context";
import {
  validateCreateAdjustmentDocumentInput,
  validateListReconciliationExceptionsInput,
  validateReconciliationExternalRecordInput,
  validateRunReconciliationInput,
  type RunReconciliationInput,
} from "./validation";

const schema = {
  ...reconciliationSchema,
  ...documentsSchema,
  ...ledgerSchema,
};

type Queryable = Database | Transaction;

interface MatchResolution {
  status: ReconciliationMatchStatus;
  matchedOperationId: string | null;
  matchedDocumentId: string | null;
  explanation: Record<string, unknown>;
  exceptionReasonCode?: string;
  exceptionReasonMeta?: Record<string, unknown> | null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

async function findOperationById(
  db: Queryable,
  operationId: string | null,
): Promise<string | null> {
  if (!operationId) {
    return null;
  }

  const [row] = await db
    .select({ id: schema.ledgerOperations.id })
    .from(schema.ledgerOperations)
    .where(eq(schema.ledgerOperations.id, operationId))
    .limit(1);

  return row?.id ?? null;
}

async function findDocumentById(
  db: Queryable,
  documentId: string | null,
): Promise<string | null> {
  if (!documentId) {
    return null;
  }

  const [row] = await db
    .select({ id: schema.documents.id })
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId))
    .limit(1);

  return row?.id ?? null;
}

async function resolveMatch(
  db: Queryable,
  record: ReconciliationExternalRecord,
): Promise<MatchResolution> {
  const normalized = record.normalizedPayload;
  const candidateOperationIds = readStringArray(
    normalized.candidateOperationIds,
  );
  const candidateDocumentIds = readStringArray(normalized.candidateDocumentIds);

  if (candidateOperationIds.length > 1 || candidateDocumentIds.length > 1) {
    return {
      status: "ambiguous",
      matchedOperationId: null,
      matchedDocumentId: null,
      explanation: {
        reason: "multiple_candidates",
        candidateOperationIds,
        candidateDocumentIds,
      },
      exceptionReasonCode: "ambiguous_match",
      exceptionReasonMeta: {
        candidateOperationIds,
        candidateDocumentIds,
      },
    };
  }

  const operationId =
    candidateOperationIds[0] ?? readString(normalized.operationId);
  const documentId =
    candidateDocumentIds[0] ?? readString(normalized.documentId);
  const matchedOperationId = await findOperationById(db, operationId);
  const matchedDocumentId = await findDocumentById(db, documentId);

  if (!matchedOperationId && !matchedDocumentId) {
    return {
      status: "unmatched",
      matchedOperationId: null,
      matchedDocumentId: null,
      explanation: {
        reason: "no_match",
        operationId,
        documentId,
      },
      exceptionReasonCode: "no_match",
      exceptionReasonMeta: {
        operationId,
        documentId,
      },
    };
  }

  return {
    status: "matched",
    matchedOperationId,
    matchedDocumentId,
    explanation: {
      reason: "matched_by_reference",
      matchedOperationId,
      matchedDocumentId,
    },
  };
}

async function getExternalRecordsForRun(
  db: Queryable,
  input: RunReconciliationInput,
) {
  const filters = [
    eq(schema.reconciliationExternalRecords.source, input.source),
  ];
  if (input.inputQuery.externalRecordIds?.length) {
    filters.push(
      inArray(
        schema.reconciliationExternalRecords.id,
        input.inputQuery.externalRecordIds,
      ),
    );
  }

  return db
    .select()
    .from(schema.reconciliationExternalRecords)
    .where(and(...filters))
    .orderBy(
      schema.reconciliationExternalRecords.receivedAt,
      schema.reconciliationExternalRecords.id,
    );
}

export type ReconciliationService = ReturnType<
  typeof createReconciliationService
>;

export function createReconciliationService(deps: ReconciliationServiceDeps) {
  const context = createReconciliationServiceContext(deps);
  const { db, documents, idempotency } = context;

  async function ingestExternalRecord(input: {
    source: string;
    sourceRecordId: string;
    rawPayload: Record<string, unknown>;
    normalizedPayload: Record<string, unknown>;
    normalizationVersion: number;
    actorUserId?: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }) {
    const validated = validateReconciliationExternalRecordInput(input);
    const payloadHash = sha256Hex(
      canonicalJson({
        source: validated.source,
        sourceRecordId: validated.sourceRecordId,
        rawPayload: validated.rawPayload,
        normalizedPayload: validated.normalizedPayload,
        normalizationVersion: validated.normalizationVersion,
      }),
    );

    return db.transaction(async (tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.RECON_INGEST_EXTERNAL_RECORD,
        idempotencyKey: input.idempotencyKey,
        request: {
          ...validated,
          payloadHash,
        },
        actorId: validated.actorUserId,
        serializeResult: (result: { id: string }) => result,
        loadReplayResult: async () => {
          const [record] = await tx
            .select()
            .from(schema.reconciliationExternalRecords)
            .where(
              and(
                eq(
                  schema.reconciliationExternalRecords.source,
                  validated.source,
                ),
                eq(
                  schema.reconciliationExternalRecords.sourceRecordId,
                  validated.sourceRecordId,
                ),
              ),
            )
            .limit(1);

          if (!record) {
            throw new Error(
              `Reconciliation external record replay is missing for ${validated.source}:${validated.sourceRecordId}`,
            );
          }

          return record;
        },
        handler: async () => {
          const [existing] = await tx
            .select()
            .from(schema.reconciliationExternalRecords)
            .where(
              and(
                eq(
                  schema.reconciliationExternalRecords.source,
                  validated.source,
                ),
                eq(
                  schema.reconciliationExternalRecords.sourceRecordId,
                  validated.sourceRecordId,
                ),
              ),
            )
            .limit(1);

          if (existing) {
            if (existing.payloadHash !== payloadHash) {
              throw new ExternalRecordConflictError(
                validated.source,
                validated.sourceRecordId,
              );
            }

            return existing;
          }

          const [inserted] = await tx
            .insert(schema.reconciliationExternalRecords)
            .values({
              source: validated.source,
              sourceRecordId: validated.sourceRecordId,
              rawPayload: validated.rawPayload,
              normalizedPayload: validated.normalizedPayload,
              payloadHash,
              normalizationVersion: validated.normalizationVersion,
              requestId: input.requestContext?.requestId ?? null,
              correlationId: input.requestContext?.correlationId ?? null,
              traceId: input.requestContext?.traceId ?? null,
              causationId: input.requestContext?.causationId ?? null,
            })
            .returning();

          return inserted!;
        },
      }),
    );
  }

  async function runReconciliation(input: {
    source: string;
    rulesetChecksum: string;
    inputQuery: { externalRecordIds?: string[] };
    actorUserId?: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }) {
    const validated = validateRunReconciliationInput(input);

    return db.transaction(async (tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.RECON_RUN,
        idempotencyKey: input.idempotencyKey,
        request: validated,
        actorId: validated.actorUserId,
        serializeResult: (result: { id: string }) => result,
        loadReplayResult: async ({ storedResult }) => {
          const [run] = await tx
            .select()
            .from(schema.reconciliationRuns)
            .where(
              eq(schema.reconciliationRuns.id, String(storedResult?.id ?? "")),
            )
            .limit(1);

          if (!run) {
            throw new Error(
              `Reconciliation run replay is missing for ${String(storedResult?.id ?? "")}`,
            );
          }

          return run;
        },
        handler: async () => {
          const records = await getExternalRecordsForRun(tx, validated);
          const resolutions = [];
          for (const record of records) {
            resolutions.push({
              record,
              resolution: await resolveMatch(tx, record),
            });
          }

          const summary = {
            total: resolutions.length,
            matched: resolutions.filter(
              (item) => item.resolution.status === "matched",
            ).length,
            unmatched: resolutions.filter(
              (item) => item.resolution.status === "unmatched",
            ).length,
            ambiguous: resolutions.filter(
              (item) => item.resolution.status === "ambiguous",
            ).length,
          };

          const [run] = await tx
            .insert(schema.reconciliationRuns)
            .values({
              source: validated.source,
              rulesetChecksum: validated.rulesetChecksum,
              inputQuery: validated.inputQuery,
              resultSummary: summary,
              requestId: input.requestContext?.requestId ?? null,
              correlationId: input.requestContext?.correlationId ?? null,
              traceId: input.requestContext?.traceId ?? null,
              causationId: input.requestContext?.causationId ?? null,
            })
            .returning();

          if (resolutions.length > 0) {
            await tx.insert(schema.reconciliationMatches).values(
              resolutions.map(({ record, resolution }) => ({
                runId: run!.id,
                externalRecordId: record.id,
                matchedOperationId: resolution.matchedOperationId,
                matchedDocumentId: resolution.matchedDocumentId,
                status: resolution.status,
                explanation: resolution.explanation,
              })),
            );
          }

          const exceptions = resolutions.filter(
            ({ resolution }) => resolution.status !== "matched",
          );
          if (exceptions.length > 0) {
            await tx.insert(schema.reconciliationExceptions).values(
              exceptions.map(({ record, resolution }) => ({
                runId: run!.id,
                externalRecordId: record.id,
                reasonCode: resolution.exceptionReasonCode ?? "unmatched",
                reasonMeta: resolution.exceptionReasonMeta ?? null,
                state: "open" as const,
              })),
            );
          }

          return run!;
        },
      }),
    );
  }

  async function listExceptions(input: {
    source?: string;
    state?: ReconciliationException["state"];
    limit?: number;
    offset?: number;
  }) {
    const validated = validateListReconciliationExceptionsInput(input);
    const filters = [];
    if (validated.state) {
      filters.push(eq(schema.reconciliationExceptions.state, validated.state));
    }
    if (validated.source) {
      filters.push(eq(schema.reconciliationRuns.source, validated.source));
    }

    const rows = await db
      .select({
        exception: schema.reconciliationExceptions,
        run: schema.reconciliationRuns,
        externalRecord: schema.reconciliationExternalRecords,
      })
      .from(schema.reconciliationExceptions)
      .innerJoin(
        schema.reconciliationRuns,
        eq(schema.reconciliationExceptions.runId, schema.reconciliationRuns.id),
      )
      .innerJoin(
        schema.reconciliationExternalRecords,
        eq(
          schema.reconciliationExceptions.externalRecordId,
          schema.reconciliationExternalRecords.id,
        ),
      )
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(schema.reconciliationExceptions.createdAt))
      .limit(validated.limit)
      .offset(validated.offset);

    return rows;
  }

  async function explainMatch(matchId: string) {
    const [match] = await db
      .select()
      .from(schema.reconciliationMatches)
      .where(eq(schema.reconciliationMatches.id, matchId))
      .limit(1);

    if (!match) {
      throw new ReconciliationMatchNotFoundError(matchId);
    }

    return match.explanation;
  }

  async function createAdjustmentDocument(input: {
    exceptionId: string;
    docType: string;
    payload: Record<string, unknown>;
    actorUserId: string;
    createIdempotencyKey?: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }) {
    const validated = validateCreateAdjustmentDocumentInput(input);

    return db.transaction(async (tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.RECON_CREATE_ADJUSTMENT_DOCUMENT,
        idempotencyKey: input.idempotencyKey,
        request: validated,
        actorId: validated.actorUserId,
        serializeResult: (result: {
          exceptionId: string;
          documentId: string;
        }) => result,
        loadReplayResult: async ({ storedResult }) => ({
          exceptionId: validated.exceptionId,
          documentId: String(storedResult?.documentId ?? ""),
        }),
        handler: async () => {
          if (!documents) {
            throw new Error(
              "Reconciliation adjustment document creation requires documents service",
            );
          }

          const [exception] = await tx
            .select()
            .from(schema.reconciliationExceptions)
            .where(
              eq(schema.reconciliationExceptions.id, validated.exceptionId),
            )
            .limit(1)
            .for("update");

          if (!exception) {
            throw new ReconciliationExceptionNotFoundError(
              validated.exceptionId,
            );
          }

          if (exception.adjustmentDocumentId) {
            return {
              exceptionId: exception.id,
              documentId: exception.adjustmentDocumentId,
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
            requestContext: input.requestContext,
          });

          await tx
            .update(schema.reconciliationExceptions)
            .set({
              state: "resolved",
              resolvedAt: new Date(),
              adjustmentDocumentId: created.document.id,
            })
            .where(eq(schema.reconciliationExceptions.id, exception.id));

          return {
            exceptionId: exception.id,
            documentId: created.document.id,
          };
        },
      }),
    );
  }

  return {
    ingestExternalRecord,
    runReconciliation,
    listExceptions,
    explainMatch,
    createAdjustmentDocument,
  };
}
