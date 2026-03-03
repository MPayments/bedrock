import { and, eq, inArray, or } from "drizzle-orm";

import { schema } from "@bedrock/core/documents/schema";

import { DocumentNotFoundError } from "../errors";
import type { DocumentsServiceContext } from "../internal/context";
import { createModuleContext, resolveModuleOrNull } from "../internal/helpers";
import type { DocumentDetails } from "../types";

export function createGetDocumentDetailsQuery(
  context: DocumentsServiceContext,
) {
  const { db, ledgerReadService, log, registry } = context;

  return async function getDocumentDetails(
    docType: string,
    documentId: string,
    actorUserId = "system",
  ): Promise<DocumentDetails> {
    const [document] = await db
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.id, documentId),
          eq(schema.documents.docType, docType),
        ),
      )
      .limit(1);

    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const module = resolveModuleOrNull(registry, docType);
    const moduleContext = module
      ? createModuleContext({
          db,
          actorUserId,
          now: new Date(),
          log,
        })
      : null;

    const links = await db
      .select()
      .from(schema.documentLinks)
      .where(
        or(
          eq(schema.documentLinks.fromDocumentId, document.id),
          eq(schema.documentLinks.toDocumentId, document.id),
        ),
      );

    const parentIds = links
      .filter(
        (link) =>
          link.fromDocumentId === document.id && link.linkType === "parent",
      )
      .map((link) => link.toDocumentId);
    const dependsOnIds = links
      .filter(
        (link) =>
          link.fromDocumentId === document.id && link.linkType === "depends_on",
      )
      .map((link) => link.toDocumentId);
    const compensatesIds = links
      .filter(
        (link) =>
          link.fromDocumentId === document.id &&
          link.linkType === "compensates",
      )
      .map((link) => link.toDocumentId);
    const childIds = links
      .filter(
        (link) =>
          link.toDocumentId === document.id && link.linkType === "parent",
      )
      .map((link) => link.fromDocumentId);

    const relatedIds = Array.from(
      new Set([...parentIds, ...dependsOnIds, ...compensatesIds, ...childIds]),
    );
    const relatedDocs =
      relatedIds.length > 0
        ? await db
            .select()
            .from(schema.documents)
            .where(inArray(schema.documents.id, relatedIds))
        : [];
    const relatedById = new Map(relatedDocs.map((item) => [item.id, item]));

    const documentOperations = await db
      .select()
      .from(schema.documentOperations)
      .where(eq(schema.documentOperations.documentId, document.id));
    const [events, snapshot] = await Promise.all([
      db
        .select()
        .from(schema.documentEvents)
        .where(eq(schema.documentEvents.documentId, document.id)),
      db
        .select()
        .from(schema.documentSnapshots)
        .where(eq(schema.documentSnapshots.documentId, document.id))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    const ledgerOperations = await Promise.all(
      documentOperations.map(async (operation) =>
        ledgerReadService.getOperationDetails(operation.operationId),
      ),
    );

    const details =
      module && moduleContext
        ? await module.buildDetails?.(moduleContext, document)
        : undefined;
    const postingOperationId =
      documentOperations.find((operation) => operation.kind === "post")
        ?.operationId ?? null;

    return {
      document,
      postingOperationId,
      links,
      events,
      snapshot,
      parent: parentIds[0] ? (relatedById.get(parentIds[0]) ?? null) : null,
      children: childIds
        .map((id) => relatedById.get(id))
        .filter(Boolean) as typeof relatedDocs,
      dependsOn: dependsOnIds
        .map((id) => relatedById.get(id))
        .filter(Boolean) as typeof relatedDocs,
      compensates: compensatesIds
        .map((id) => relatedById.get(id))
        .filter(Boolean) as typeof relatedDocs,
      documentOperations,
      ledgerOperations,
      computed: details?.computed,
      extra: details?.extra,
    };
  };
}
