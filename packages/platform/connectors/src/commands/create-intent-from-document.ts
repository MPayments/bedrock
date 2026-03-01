import { eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/idempotency";

import type { ConnectorsServiceContext } from "../internal/context";
import {
  CreateIntentFromDocumentInputSchema,
  type CreateIntentFromDocumentInput,
} from "../validation";

export function createCreateIntentFromDocumentHandler(
  context: ConnectorsServiceContext,
) {
  const { db, idempotency } = context;

  return async function createIntentFromDocument(
    input: CreateIntentFromDocumentInput,
  ) {
    const validated = CreateIntentFromDocumentInputSchema.parse(input);

    return db.transaction((tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.CONNECTORS_CREATE_INTENT,
        idempotencyKey: validated.idempotencyKey,
        request: validated,
        actorId: validated.actorUserId,
        serializeResult: (result: { id: string }) => ({
          id: result.id,
        }),
        loadReplayResult: async ({ storedResult }) => {
          const [existingById] = await tx
            .select()
            .from(schema.connectorPaymentIntents)
            .where(
              eq(
                schema.connectorPaymentIntents.id,
                String(storedResult?.id ?? ""),
              ),
            )
            .limit(1);

          if (existingById) {
            return existingById;
          }

          const [existingByDocument] = await tx
            .select()
            .from(schema.connectorPaymentIntents)
            .where(
              eq(
                schema.connectorPaymentIntents.documentId,
                validated.documentId,
              ),
            )
            .limit(1);

          if (!existingByDocument) {
            throw new Error(
              `Connector intent replay is missing for document ${validated.documentId}`,
            );
          }

          return existingByDocument;
        },
        handler: async () => {
          const [existing] = await tx
            .select()
            .from(schema.connectorPaymentIntents)
            .where(
              eq(
                schema.connectorPaymentIntents.documentId,
                validated.documentId,
              ),
            )
            .limit(1)
            .for("update");

          if (existing) {
            return existing;
          }

          const [created] = await tx
            .insert(schema.connectorPaymentIntents)
            .values({
              documentId: validated.documentId,
              docType: validated.docType,
              direction: validated.direction,
              amountMinor: validated.amountMinor,
              currency: validated.currency,
              corridor: validated.corridor ?? null,
              providerConstraint: validated.providerConstraint ?? null,
              status: "planned",
              currentAttemptNo: 0,
              metadata: validated.metadata ?? null,
            })
            .returning();

          return created!;
        },
      }),
    );
  };
}
