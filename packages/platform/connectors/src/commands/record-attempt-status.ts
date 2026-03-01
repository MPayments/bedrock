import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/idempotency";

import {
  ConnectorIntentNotFoundError,
  PaymentAttemptNotFoundError,
} from "../errors";
import type { ConnectorsServiceContext } from "../internal/context";
import {
  intentStatusFromAttemptStatus,
  isTerminalAttemptStatus,
} from "../internal/status";
import {
  RecordAttemptStatusInputSchema,
  type RecordAttemptStatusInput,
} from "../validation";

export function createRecordAttemptStatusHandler(
  context: ConnectorsServiceContext,
) {
  const { db, idempotency } = context;

  return async function recordAttemptStatus(input: RecordAttemptStatusInput) {
    const validated = RecordAttemptStatusInputSchema.parse(input);

    return db.transaction((tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.CONNECTORS_RECORD_ATTEMPT_STATUS,
        idempotencyKey: validated.idempotencyKey,
        request: validated,
        actorId: validated.actorUserId,
        serializeResult: (result: { id: string }) => ({ id: result.id }),
        loadReplayResult: async ({ storedResult }) => {
          const [existing] = await tx
            .select()
            .from(schema.paymentAttempts)
            .where(
              eq(schema.paymentAttempts.id, String(storedResult?.id ?? "")),
            )
            .limit(1);

          if (!existing) {
            throw new Error(
              `Connector attempt replay is missing for ${String(storedResult?.id ?? "")}`,
            );
          }

          return existing;
        },
        handler: async () => {
          const [attempt] = await tx
            .select()
            .from(schema.paymentAttempts)
            .where(eq(schema.paymentAttempts.id, validated.attemptId))
            .limit(1)
            .for("update");

          if (!attempt) {
            throw new PaymentAttemptNotFoundError(validated.attemptId);
          }

          const [updatedAttempt] = await tx
            .update(schema.paymentAttempts)
            .set({
              status: validated.status,
              externalAttemptRef:
                validated.externalAttemptRef ??
                attempt.externalAttemptRef ??
                null,
              responsePayload:
                validated.responsePayload ?? attempt.responsePayload ?? null,
              error: validated.error ?? null,
              nextRetryAt: validated.nextRetryAt ?? null,
              resolvedAt: isTerminalAttemptStatus(validated.status)
                ? sql`now()`
                : attempt.resolvedAt,
              updatedAt: sql`now()`,
            })
            .where(eq(schema.paymentAttempts.id, attempt.id))
            .returning();

          if (!updatedAttempt) {
            throw new PaymentAttemptNotFoundError(validated.attemptId);
          }

          const [intent] = await tx
            .select()
            .from(schema.connectorPaymentIntents)
            .where(
              eq(schema.connectorPaymentIntents.id, updatedAttempt.intentId),
            )
            .limit(1)
            .for("update");

          if (!intent) {
            throw new ConnectorIntentNotFoundError(updatedAttempt.intentId);
          }

          const intentStatus = intentStatusFromAttemptStatus(validated.status);
          await tx
            .update(schema.connectorPaymentIntents)
            .set({
              status: intentStatus,
              lastError: validated.error ?? null,
              updatedAt: sql`now()`,
            })
            .where(eq(schema.connectorPaymentIntents.id, intent.id));

          if (updatedAttempt.externalAttemptRef) {
            await tx
              .insert(schema.connectorReferences)
              .values({
                providerCode: updatedAttempt.providerCode,
                intentId: intent.id,
                attemptId: updatedAttempt.id,
                refKind: "attempt_ref",
                refValue: updatedAttempt.externalAttemptRef,
                meta: null,
              })
              .onConflictDoNothing({
                target: [
                  schema.connectorReferences.providerCode,
                  schema.connectorReferences.refKind,
                  schema.connectorReferences.refValue,
                ],
              });
          }

          return updatedAttempt;
        },
      }),
    );
  };
}
