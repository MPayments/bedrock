import { and, eq } from "drizzle-orm";

import { schema } from "@bedrock/app/documents/schema";

import { DocumentNotFoundError } from "../errors";
import type { DocumentsServiceContext } from "../internal/context";
import {
  buildDocumentWithOperationId,
  resolveDocumentAllowedActionsForActor,
} from "../internal/helpers";
import type { DocumentWithOperationId } from "../types";

export function createGetDocumentQuery(context: DocumentsServiceContext) {
  const { db, log, policy, registry } = context;

  return async function getDocument(
    docType: string,
    documentId: string,
    actorUserId?: string,
  ): Promise<DocumentWithOperationId> {
    const [row] = await db
      .select({
        document: schema.documents,
        postingOperationId: schema.documentOperations.operationId,
      })
      .from(schema.documents)
      .leftJoin(
        schema.documentOperations,
        and(
          eq(schema.documentOperations.documentId, schema.documents.id),
          eq(schema.documentOperations.kind, "post"),
        ),
      )
      .where(
        and(eq(schema.documents.id, documentId), eq(schema.documents.docType, docType)),
      )
      .limit(1);

    if (!row) {
      throw new DocumentNotFoundError(documentId);
    }

    const result = buildDocumentWithOperationId({
      registry,
      document: row.document,
      postingOperationId: row.postingOperationId ?? null,
    });

    if (!actorUserId) {
      return result;
    }

    return {
      ...result,
      allowedActions: await resolveDocumentAllowedActionsForActor({
        registry,
        policy,
        db,
        log,
        actorUserId,
        document: row.document,
      }),
    };
  };
}
