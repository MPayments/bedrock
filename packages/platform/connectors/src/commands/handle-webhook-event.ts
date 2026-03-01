import { and, eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/idempotency";

import type { ConnectorsServiceContext } from "../internal/context";
import {
  HandleWebhookEventInputSchema,
  type HandleWebhookEventInput,
} from "../validation";

export function createHandleWebhookEventHandler(
  context: ConnectorsServiceContext,
  deps: {
    recordAttemptStatus: (input: {
      attemptId: string;
      status:
        | "queued"
        | "dispatching"
        | "submitted"
        | "pending"
        | "succeeded"
        | "failed_retryable"
        | "failed_terminal"
        | "cancelled";
      externalAttemptRef?: string;
      responsePayload?: Record<string, unknown>;
      error?: string;
      nextRetryAt?: Date;
      idempotencyKey: string;
      actorUserId?: string;
    }) => Promise<unknown>;
  },
) {
  const { db, idempotency } = context;
  const { recordAttemptStatus } = deps;

  return async function handleWebhookEvent(input: HandleWebhookEventInput) {
    const validated = HandleWebhookEventInputSchema.parse(input);

    return db.transaction((tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.CONNECTORS_HANDLE_WEBHOOK,
        idempotencyKey: validated.idempotencyKey,
        request: validated,
        actorId: validated.actorUserId,
        serializeResult: (result: { id: string }) => ({ id: result.id }),
        loadReplayResult: async ({ storedResult }) => {
          const [existingById] = await tx
            .select()
            .from(schema.connectorEvents)
            .where(
              eq(schema.connectorEvents.id, String(storedResult?.id ?? "")),
            )
            .limit(1);

          if (existingById) {
            return existingById;
          }

          const [existingByProviderKey] = await tx
            .select()
            .from(schema.connectorEvents)
            .where(
              and(
                eq(schema.connectorEvents.providerCode, validated.providerCode),
                eq(
                  schema.connectorEvents.webhookIdempotencyKey,
                  validated.webhookIdempotencyKey,
                ),
              ),
            )
            .limit(1);

          if (!existingByProviderKey) {
            throw new Error(
              `Connector webhook replay is missing for ${validated.providerCode}:${validated.webhookIdempotencyKey}`,
            );
          }

          return existingByProviderKey;
        },
        handler: async () => {
          const [created] = await tx
            .insert(schema.connectorEvents)
            .values({
              providerCode: validated.providerCode,
              eventType: validated.eventType,
              webhookIdempotencyKey: validated.webhookIdempotencyKey,
              signatureValid: validated.signatureValid,
              parseStatus: validated.signatureValid ? "accepted" : "rejected",
              rawPayload: validated.rawPayload,
              parsedPayload: validated.parsedPayload ?? null,
              intentId: validated.intentId ?? null,
              attemptId: validated.attemptId ?? null,
              error: validated.error ?? null,
              processedAt: sql`now()`,
            })
            .onConflictDoNothing({
              target: [
                schema.connectorEvents.providerCode,
                schema.connectorEvents.webhookIdempotencyKey,
              ],
            })
            .returning();

          if (!created) {
            const [existing] = await tx
              .select()
              .from(schema.connectorEvents)
              .where(
                and(
                  eq(
                    schema.connectorEvents.providerCode,
                    validated.providerCode,
                  ),
                  eq(
                    schema.connectorEvents.webhookIdempotencyKey,
                    validated.webhookIdempotencyKey,
                  ),
                ),
              )
              .limit(1);

            if (!existing) {
              throw new Error(
                `Connector webhook event conflict without existing record for ${validated.providerCode}:${validated.webhookIdempotencyKey}`,
              );
            }

            return existing;
          }

          if (
            validated.signatureValid &&
            validated.attemptId &&
            validated.status
          ) {
            await recordAttemptStatus({
              attemptId: validated.attemptId,
              status: validated.status,
              externalAttemptRef: validated.externalAttemptRef,
              responsePayload: validated.parsedPayload,
              error: validated.error,
              idempotencyKey: `${validated.idempotencyKey}:attempt-status`,
              actorUserId: validated.actorUserId,
            });
          }

          return created;
        },
      }),
    );
  };
}
