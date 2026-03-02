import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema/connectors";
import { IDEMPOTENCY_SCOPE } from "@bedrock/platform/idempotency";

import { ConnectorIntentNotFoundError } from "../errors";
import type { ConnectorsServiceContext } from "../internal/context";
import {
  MarkIntentTerminalInputSchema,
  type MarkIntentTerminalInput,
} from "../validation";

export function createMarkIntentTerminalHandler(
  context: ConnectorsServiceContext,
) {
  const { db, idempotency } = context;

  return async function markIntentTerminal(input: MarkIntentTerminalInput) {
    const validated = MarkIntentTerminalInputSchema.parse(input);

    return db.transaction((tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.CONNECTORS_MARK_INTENT_TERMINAL,
        idempotencyKey: validated.idempotencyKey,
        request: validated,
        actorId: validated.actorUserId,
        serializeResult: (result: { id: string }) => ({ id: result.id }),
        loadReplayResult: async ({ storedResult }) => {
          const [intent] = await tx
            .select()
            .from(schema.connectorPaymentIntents)
            .where(
              eq(
                schema.connectorPaymentIntents.id,
                String(storedResult?.id ?? ""),
              ),
            )
            .limit(1);

          if (!intent) {
            throw new Error(
              `Connector intent terminal replay is missing for ${String(storedResult?.id ?? "")}`,
            );
          }

          return intent;
        },
        handler: async () => {
          const [updated] = await tx
            .update(schema.connectorPaymentIntents)
            .set({
              status: validated.status,
              lastError: validated.error ?? null,
              updatedAt: sql`now()`,
            })
            .where(eq(schema.connectorPaymentIntents.id, validated.intentId))
            .returning();

          if (!updated) {
            throw new ConnectorIntentNotFoundError(validated.intentId);
          }

          return updated;
        },
      }),
    );
  };
}
