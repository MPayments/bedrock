import {
  RunReconciliationInputSchema,
  type ReconciliationRunDto,
  type RunReconciliationInput,
} from "../../contracts";
import { extractCandidateReferences } from "../../domain/candidate-references";
import { RECONCILIATION_IDEMPOTENCY_SCOPE } from "../../domain/idempotency";
import { resolveMatchFromCandidates } from "../../domain/matching";
import { ReconciliationException } from "../../domain/reconciliation-exception";
import { ReconciliationRun } from "../../domain/reconciliation-run";
import { toReconciliationRunDto } from "../mappers";
import type { ReconciliationExternalRecordRecord } from "../records/ports";
import type { ReconciliationServiceContext } from "../shared/context";

async function findOperationById(
  context: ReconciliationServiceContext,
  operationId: string | null,
  operationKind: "ledger" | "treasury" | null,
): Promise<{
  matchedOperationId: string | null;
  matchedTreasuryOperationId: string | null;
}> {
  if (!operationId) {
    return {
      matchedOperationId: null,
      matchedTreasuryOperationId: null,
    };
  }

  if (operationKind === "treasury") {
    return {
      matchedOperationId: null,
      matchedTreasuryOperationId: (await context.ledgerLookup.treasuryOperationExists(
        operationId,
      ))
        ? operationId
        : null,
    };
  }

  if (operationKind === "ledger") {
    return {
      matchedOperationId: (await context.ledgerLookup.operationExists(
        operationId,
      ))
        ? operationId
        : null,
      matchedTreasuryOperationId: null,
    };
  }

  if (await context.ledgerLookup.operationExists(operationId)) {
    return {
      matchedOperationId: operationId,
      matchedTreasuryOperationId: null,
    };
  }

  return {
    matchedOperationId: null,
    matchedTreasuryOperationId: (await context.ledgerLookup.treasuryOperationExists(
      operationId,
    ))
      ? operationId
      : null,
  };
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
      matchedTreasuryOperationId: null,
      matchedDocumentId: null,
    });
  }

  const matchedOperation = await findOperationById(
    context,
    candidates.operationId,
    candidates.operationKind,
  );
  const matchedDocumentId = await findDocumentById(context, candidates.documentId);

  return resolveMatchFromCandidates({
    ...candidates,
    matchedOperationId: matchedOperation.matchedOperationId,
    matchedTreasuryOperationId: matchedOperation.matchedTreasuryOperationId,
    matchedDocumentId,
  });
}

export function createRunReconciliationHandler(
  context: ReconciliationServiceContext,
) {
  const { transactions } = context;

  return async function runReconciliation(
    input: RunReconciliationInput,
  ): Promise<ReconciliationRunDto> {
    const validated = RunReconciliationInputSchema.parse(input);

    const run = await transactions.withTransaction(
      async ({ exceptions, externalRecords, idempotency, matches, runs }) =>
        idempotency.withIdempotency({
        scope: RECONCILIATION_IDEMPOTENCY_SCOPE.RUN,
        idempotencyKey: validated.idempotencyKey,
        request: validated,
        actorId: validated.actorUserId,
        serializeResult: (result: { id: string }) => result,
        loadReplayResult: async ({ storedResult }) => {
          const replayRun = await runs.findById(String(storedResult?.id ?? ""));

          if (!replayRun) {
            throw new Error(
              `Reconciliation run replay is missing for ${String(storedResult?.id ?? "")}`,
            );
          }

          return replayRun;
        },
        handler: async () => {
          const records = await externalRecords.listForRun({
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

          const plannedRun = ReconciliationRun.plan({
            source: validated.source,
            rulesetChecksum: validated.rulesetChecksum,
            inputQuery: validated.inputQuery,
            resolutions: resolutions.map((item) => item.resolution),
            requestContext: validated.requestContext,
          });

          const createdRun = await runs.create(plannedRun.toDraft());

          if (resolutions.length > 0) {
            await matches.createMany(
              resolutions.map(({ record, resolution }) => ({
                runId: createdRun.id,
                externalRecordId: record.id,
                matchedOperationId: resolution.matchedOperationId,
                matchedTreasuryOperationId:
                  resolution.matchedTreasuryOperationId,
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
            await exceptions.createMany(
              exceptionResolutions.map(({ record, resolution }) =>
                ReconciliationException.open({
                  runId: createdRun.id,
                  externalRecordId: record.id,
                  reasonCode: resolution.exceptionReasonCode ?? "unmatched",
                  reasonMeta: resolution.exceptionReasonMeta ?? null,
                }),
              ),
            );
          }

          return createdRun;
        },
      }),
    );

    return toReconciliationRunDto(run);
  };
}
