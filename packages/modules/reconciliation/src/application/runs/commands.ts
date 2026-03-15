import {
  RunReconciliationInputSchema,
  type ReconciliationRunDto,
  type RunReconciliationInput,
} from "../../contracts";
import { extractCandidateReferences } from "../../domain/candidate-references";
import { summarizeResolutions } from "../../domain/exceptions";
import { RECONCILIATION_IDEMPOTENCY_SCOPE } from "../../domain/idempotency";
import { resolveMatchFromCandidates } from "../../domain/matching";
import { toReconciliationRunDto } from "../mappers";
import type { ReconciliationExternalRecordRecord } from "../ports";
import type { ReconciliationServiceContext } from "../shared/context";

async function findOperationById(
  context: ReconciliationServiceContext,
  operationId: string | null,
): Promise<string | null> {
  if (!operationId) {
    return null;
  }

  return (await context.ledgerLookup.operationExists(operationId))
    ? operationId
    : null;
}

async function findDocumentById(
  context: ReconciliationServiceContext,
  documentId: string | null,
): Promise<string | null> {
  if (!documentId) {
    return null;
  }

  return (await context.documents.existsById(documentId)) ? documentId : null;
}

async function resolveRecordMatch(
  context: ReconciliationServiceContext,
  record: ReconciliationExternalRecordRecord,
) {
  const candidates = extractCandidateReferences(record.normalizedPayload);

  if (
    candidates.candidateOperationIds.length > 1 ||
    candidates.candidateDocumentIds.length > 1
  ) {
    return resolveMatchFromCandidates({
      ...candidates,
      matchedOperationId: null,
      matchedDocumentId: null,
    });
  }

  const matchedOperationId = await findOperationById(
    context,
    candidates.operationId,
  );
  const matchedDocumentId = await findDocumentById(context, candidates.documentId);

  return resolveMatchFromCandidates({
    ...candidates,
    matchedOperationId,
    matchedDocumentId,
  });
}

export function createRunReconciliationHandler(
  context: ReconciliationServiceContext,
) {
  const {
    db,
    externalRecordsRepo,
    exceptionsRepo,
    idempotency,
    matchesRepo,
    runsRepo,
  } = context;

  return async function runReconciliation(
    input: RunReconciliationInput,
  ): Promise<ReconciliationRunDto> {
    const validated = RunReconciliationInputSchema.parse(input);

    const run = await db.transaction(async (tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: RECONCILIATION_IDEMPOTENCY_SCOPE.RUN,
        idempotencyKey: validated.idempotencyKey,
        request: validated,
        actorId: validated.actorUserId,
        serializeResult: (result: { id: string }) => result,
        loadReplayResult: async ({ storedResult }) => {
          const replayRun = await runsRepo.findById(
            tx,
            String(storedResult?.id ?? ""),
          );

          if (!replayRun) {
            throw new Error(
              `Reconciliation run replay is missing for ${String(storedResult?.id ?? "")}`,
            );
          }

          return replayRun;
        },
        handler: async () => {
          const records = await externalRecordsRepo.listForRun(tx, {
            source: validated.source,
            externalRecordIds: validated.inputQuery.externalRecordIds,
          });

          const resolutions = [];
          for (const record of records) {
            resolutions.push({
              record,
              resolution: await resolveRecordMatch(context, record),
            });
          }

          const summary = summarizeResolutions(
            resolutions.map((item) => item.resolution),
          );

          const createdRun = await runsRepo.create(tx, {
            source: validated.source,
            rulesetChecksum: validated.rulesetChecksum,
            inputQuery: validated.inputQuery,
            resultSummary: summary,
            requestId: validated.requestContext?.requestId ?? null,
            correlationId: validated.requestContext?.correlationId ?? null,
            traceId: validated.requestContext?.traceId ?? null,
            causationId: validated.requestContext?.causationId ?? null,
          });

          if (resolutions.length > 0) {
            await matchesRepo.createMany(
              tx,
              resolutions.map(({ record, resolution }) => ({
                runId: createdRun.id,
                externalRecordId: record.id,
                matchedOperationId: resolution.matchedOperationId,
                matchedDocumentId: resolution.matchedDocumentId,
                status: resolution.status,
                explanation: resolution.explanation,
              })),
            );
          }

          const exceptionResolutions = resolutions.filter(
            ({ resolution }) => resolution.status !== "matched",
          );
          if (exceptionResolutions.length > 0) {
            await exceptionsRepo.createMany(
              tx,
              exceptionResolutions.map(({ record, resolution }) => ({
                runId: createdRun.id,
                externalRecordId: record.id,
                reasonCode: resolution.exceptionReasonCode ?? "unmatched",
                reasonMeta: resolution.exceptionReasonMeta ?? null,
                state: "open",
              })),
            );
          }

          return createdRun;
        },
      }),
    );

    return toReconciliationRunDto(run);
  };
}
