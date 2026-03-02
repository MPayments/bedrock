import { and, eq } from "drizzle-orm";

import { schema } from "@bedrock/documents/schema";

import { DocumentNotFoundError } from "../errors";
import type { DocumentsServiceContext } from "../internal/context";
import type { DocumentWithOperationId } from "../types";

export function createGetDocumentQuery(context: DocumentsServiceContext) {
  const { db } = context;

  return async function getDocument(
    docType: string,
    documentId: string,
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

    return {
      document: row.document,
      postingOperationId: row.postingOperationId ?? null,
    };
  };
}
