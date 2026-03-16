import { sha256Hex } from "@bedrock/platform/crypto";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { DomainError } from "@bedrock/shared/core/domain";

import {
  ReconciliationExternalRecordInputSchema,
  type ReconciliationExternalRecordDto,
  type ReconciliationExternalRecordInput,
} from "../../contracts";
import { ExternalRecord } from "../../domain/external-record";
import { RECONCILIATION_IDEMPOTENCY_SCOPE } from "../../domain/idempotency";
import { ExternalRecordConflictError } from "../../errors";
import { toReconciliationExternalRecordDto } from "../mappers";
import type { ReconciliationServiceContext } from "../shared/context";

export function createIngestExternalRecordHandler(
  context: ReconciliationServiceContext,
) {
  const { db, externalRecordsRepo, idempotency } = context;

  return async function ingestExternalRecord(
    input: ReconciliationExternalRecordInput,
  ): Promise<ReconciliationExternalRecordDto> {
    const validated = ReconciliationExternalRecordInputSchema.parse(input);
    const payloadHash = sha256Hex(
      canonicalJson({
        source: validated.source,
        sourceRecordId: validated.sourceRecordId,
        rawPayload: validated.rawPayload,
        normalizedPayload: validated.normalizedPayload,
        normalizationVersion: validated.normalizationVersion,
      }),
    );

    const record = await db.transaction(async (tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: RECONCILIATION_IDEMPOTENCY_SCOPE.INGEST_EXTERNAL_RECORD,
        idempotencyKey: validated.idempotencyKey,
        request: {
          ...validated,
          payloadHash,
        },
        actorId: validated.actorUserId,
        serializeResult: (result: { id: string }) => result,
        loadReplayResult: async () => {
          const existing =
            await externalRecordsRepo.findBySourceAndSourceRecordIdTx(tx, {
              source: validated.source,
              sourceRecordId: validated.sourceRecordId,
            });

          if (!existing) {
            throw new Error(
              `Reconciliation external record replay is missing for ${validated.source}:${validated.sourceRecordId}`,
            );
          }

          return existing;
        },
        handler: async () => {
          const existing =
            await externalRecordsRepo.findBySourceAndSourceRecordIdTx(tx, {
              source: validated.source,
              sourceRecordId: validated.sourceRecordId,
            });

          if (existing) {
            try {
              ExternalRecord.fromSnapshot(existing).assertSamePayloadHash(
                payloadHash,
              );
            } catch (error) {
              if (
                error instanceof DomainError &&
                error.code === "reconciliation.external_record.payload_conflict"
              ) {
                throw new ExternalRecordConflictError(
                  validated.source,
                  validated.sourceRecordId,
                );
              }

              throw error;
            }

            return existing;
          }

          return externalRecordsRepo.createTx(tx, {
            source: validated.source,
            sourceRecordId: validated.sourceRecordId,
            rawPayload: validated.rawPayload,
            normalizedPayload: validated.normalizedPayload,
            payloadHash,
            normalizationVersion: validated.normalizationVersion,
            requestId: validated.requestContext?.requestId ?? null,
            correlationId: validated.requestContext?.correlationId ?? null,
            traceId: validated.requestContext?.traceId ?? null,
            causationId: validated.requestContext?.causationId ?? null,
          });
        },
      }),
    );

    return toReconciliationExternalRecordDto(record);
  };
}
