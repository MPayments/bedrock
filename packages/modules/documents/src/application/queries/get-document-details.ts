import { DocumentNotFoundError } from "../../errors";
import type { DocumentDetails } from "../../types";
import { resolveDocumentAllowedActionsForActor } from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";
import {
  createModuleContext,
  resolveModuleForDocument,
} from "../shared/module-resolution";

export function createGetDocumentDetailsQuery(
  context: DocumentsServiceContext,
) {
  const {
    accountingPeriods,
    ledgerReadService,
    log,
    moduleDb,
    policy,
    registry,
    repository,
  } = context;

  return async function getDocumentDetails(
    docType: string,
    documentId: string,
    actorUserId = "system",
  ): Promise<DocumentDetails> {
    const document = await repository.findDocumentByType({
      documentId,
      docType,
    });

    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    let module = null;
    try {
      module = resolveModuleForDocument(registry, document);
    } catch (error) {
      log.warn("documents get details: module resolution failed", {
        docType,
        documentId,
        moduleId: document.moduleId,
        moduleVersion: document.moduleVersion,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const moduleContext = module
      ? createModuleContext({
          db: moduleDb,
          actorUserId,
          now: new Date(),
          log,
          operationIdempotencyKey: null,
        })
      : null;

    const links = await repository.listDocumentLinks(document.id);
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
    const [relatedDocs, documentOperations, events, snapshot] = await Promise.all([
      repository.listDocumentsByIds(relatedIds),
      repository.listDocumentOperations(document.id),
      repository.listDocumentEvents(document.id),
      repository.findDocumentSnapshot(document.id),
    ]);
    const relatedById = new Map(relatedDocs.map((item) => [item.id, item]));

    const ledgerOperations = await Promise.all(
      documentOperations.map(async (operation) =>
        ledgerReadService.getOperationDetails(operation.operationId),
      ),
    );

    let details:
      | {
          computed?: unknown;
          extra?: unknown;
        }
      | undefined;
    if (module && moduleContext && module.buildDetails) {
      try {
        details = await module.buildDetails(moduleContext, document);
      } catch (error) {
        log.warn("documents get details: failed to build module details", {
          docType,
          documentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const postingOperationId =
      documentOperations.find((operation) => operation.kind === "post")
        ?.operationId ?? null;
    const allowedActions = await resolveDocumentAllowedActionsForActor({
      accountingPeriods,
      moduleDb,
      registry,
      policy,
      log,
      actorUserId,
      document,
    });

    return {
      document,
      postingOperationId,
      allowedActions,
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
