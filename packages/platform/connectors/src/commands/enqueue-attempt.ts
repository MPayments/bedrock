import { and, eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/idempotency";

import {
  ConnectorIntentNotFoundError,
  ConnectorIntentTerminalError,
  ConnectorMaxAttemptsExceededError,
} from "../errors";
import type { ConnectorsServiceContext } from "../internal/context";
import { isTerminalIntentStatus } from "../internal/status";
import {
  EnqueueAttemptInputSchema,
  type EnqueueAttemptInput,
} from "../validation";

export function createEnqueueAttemptHandler(context: ConnectorsServiceContext) {
  const { db, idempotency } = context;

  return async function enqueueAttempt(input: EnqueueAttemptInput) {
    const validated = EnqueueAttemptInputSchema.parse(input);

    return db.transaction((tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.CONNECTORS_ENQUEUE_ATTEMPT,
        idempotencyKey: validated.idempotencyKey,
        request: validated,
        actorId: validated.actorUserId,
        serializeResult: (result: { id: string; intentId: string }) => ({
          attemptId: result.id,
          intentId: result.intentId,
        }),
        loadReplayResult: async ({ storedResult }) => {
          const [attempt] = await tx
            .select()
            .from(schema.paymentAttempts)
            .where(
              eq(
                schema.paymentAttempts.id,
                String(storedResult?.attemptId ?? ""),
              ),
            )
            .limit(1);

          if (!attempt) {
            throw new Error(
              `Connector enqueue replay is missing for ${String(storedResult?.attemptId ?? "")}`,
            );
          }

          return attempt;
        },
        handler: async () => {
          const [intent] = await tx
            .select()
            .from(schema.connectorPaymentIntents)
            .where(eq(schema.connectorPaymentIntents.id, validated.intentId))
            .limit(1)
            .for("update");

          if (!intent) {
            throw new ConnectorIntentNotFoundError(validated.intentId);
          }
          if (isTerminalIntentStatus(intent.status)) {
            throw new ConnectorIntentTerminalError(intent.id, intent.status);
          }

          const MAX_ATTEMPTS_PER_INTENT = 10;
          if (intent.currentAttemptNo >= MAX_ATTEMPTS_PER_INTENT) {
            throw new ConnectorMaxAttemptsExceededError(
              intent.id,
              intent.currentAttemptNo,
              MAX_ATTEMPTS_PER_INTENT,
            );
          }

          const attemptNo = intent.currentAttemptNo + 1;
          const [attempt] = await tx
            .insert(schema.paymentAttempts)
            .values({
              intentId: intent.id,
              attemptNo,
              providerCode: validated.providerCode,
              providerRoute: validated.providerRoute ?? null,
              status: "queued",
              idempotencyKey: validated.idempotencyKey,
              requestPayload: validated.requestPayload ?? null,
              nextRetryAt: validated.nextRetryAt ?? null,
            })
            .returning();

          await tx
            .update(schema.connectorPaymentIntents)
            .set({
              currentAttemptNo: attemptNo,
              status: "in_progress",
              updatedAt: sql`now()`,
            })
            .where(
              and(
                eq(schema.connectorPaymentIntents.id, intent.id),
                eq(
                  schema.connectorPaymentIntents.currentAttemptNo,
                  intent.currentAttemptNo,
                ),
              ),
            );

          return attempt!;
        },
      }),
    );
  };
}
