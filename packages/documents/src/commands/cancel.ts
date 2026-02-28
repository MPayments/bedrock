import { and, eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { InvalidStateError } from "@bedrock/kernel/errors";

import { createModuleContext, lockDocument, resolveModule } from "../internal/helpers";
import type { DocumentsServiceContext } from "../internal/context";
import type { DocumentWithOperationId } from "../types";

export function createCancelHandler(context: DocumentsServiceContext) {
  const { db, log, registry } = context;

  return async function cancel(input: {
    docType: string;
    documentId: string;
    actorUserId: string;
  }): Promise<DocumentWithOperationId> {
    const module = resolveModule(registry, input.docType);

    return db.transaction(async (tx) => {
      const moduleContext = createModuleContext({
        db: tx,
        actorUserId: input.actorUserId,
        now: new Date(),
        log,
      });
      const document = await lockDocument(tx, input.documentId, input.docType);

      if (
        document.lifecycleStatus !== "active" ||
        !["unposted", "failed"].includes(document.postingStatus)
      ) {
        throw new InvalidStateError(
          "Only active documents in unposted or failed status can be cancelled",
        );
      }

      await module.canCancel(moduleContext, document);

      const [stored] = await tx
        .update(schema.documents)
        .set({
          lifecycleStatus: "cancelled",
          cancelledBy: input.actorUserId,
          cancelledAt: sql`now()`,
          updatedAt: sql`now()`,
          version: sql`${schema.documents.version} + 1`,
        })
        .where(
          and(
            eq(schema.documents.id, document.id),
            eq(schema.documents.docType, input.docType),
          ),
        )
        .returning();

      return { document: stored!, postingOperationId: null };
    });
  };
}
