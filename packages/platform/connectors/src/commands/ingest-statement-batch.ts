import { sql } from "drizzle-orm";

import { schema } from "@bedrock/connectors/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/idempotency";

import type { ConnectorsServiceContext } from "../internal/context";
import {
  IngestStatementBatchInputSchema,
  type IngestStatementBatchInput,
} from "../validation";

export function createIngestStatementBatchHandler(
  context: ConnectorsServiceContext,
) {
  const { db, idempotency } = context;

  return async function ingestStatementBatch(input: IngestStatementBatchInput) {
    const validated = IngestStatementBatchInputSchema.parse(input);

    return db.transaction((tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.CONNECTORS_INGEST_STATEMENTS,
        idempotencyKey: validated.idempotencyKey,
        request: validated,
        actorId: validated.actorUserId,
        serializeResult: (result: { inserted: number }) => result,
        loadReplayResult: async ({ storedResult }) => ({
          inserted: Number(storedResult?.inserted ?? 0),
        }),
        handler: async () => {
          let inserted = 0;
          for (const record of validated.records) {
            const [event] = await tx
              .insert(schema.connectorEvents)
              .values({
                providerCode: validated.providerCode,
                eventType: "statement_record",
                webhookIdempotencyKey: `${validated.providerCode}:statement:${validated.cursorKey}:${record.recordId}`,
                signatureValid: true,
                parseStatus: "accepted",
                rawPayload: record.payload,
                parsedPayload: {
                  recordId: record.recordId,
                  occurredAt: record.occurredAt.toISOString(),
                },
                receivedAt: record.occurredAt,
                processedAt: sql`now()`,
              })
              .onConflictDoNothing({
                target: [
                  schema.connectorEvents.providerCode,
                  schema.connectorEvents.webhookIdempotencyKey,
                ],
              })
              .returning({ id: schema.connectorEvents.id });

            if (event) {
              inserted += 1;
            }
          }

          await tx
            .insert(schema.connectorCursors)
            .values({
              providerCode: validated.providerCode,
              cursorKey: validated.cursorKey,
              cursorValue: validated.cursorValue ?? null,
              lastFetchedAt: sql`now()`,
            })
            .onConflictDoUpdate({
              target: [
                schema.connectorCursors.providerCode,
                schema.connectorCursors.cursorKey,
              ],
              set: {
                cursorValue: validated.cursorValue ?? null,
                claimToken: null,
                claimUntil: null,
                lastFetchedAt: sql`now()`,
                updatedAt: sql`now()`,
              },
            });

          return { inserted };
        },
      }),
    );
  };
}
