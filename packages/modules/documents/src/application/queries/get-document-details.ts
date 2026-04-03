import type { DocumentDetails } from "../../contracts/dto";
import { DocumentNotFoundError } from "../../errors";
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
    documentBusinessLinks,
    documentEvents,
    documentLinks,
    documentOperations,
    documentSnapshots,
    documentsQuery,
    ledgerReadService,
    log,
    moduleRuntime,
    now,
    policy,
    registry,
  } = context;

  return async function getDocumentDetails(
    docType: string,
    documentId: string,
    actorUserId = "system",
  ): Promise<DocumentDetails> {
    const document = await documentsQuery.findDocumentByType({
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
          actorUserId,
          now: now(),
          log,
          operationIdempotencyKey: null,
          runtime: moduleRuntime,
        })
      : null;

    const links = await documentLinks.listDocumentLinks(document.id);
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
    const [dealId, relatedDocs, operations, events, snapshot] = await Promise.all([
      documentBusinessLinks.findDealIdByDocumentId(document.id),
      documentsQuery.listDocumentsByIds(relatedIds),
      documentOperations.listDocumentOperations(document.id),
      documentEvents.listDocumentEvents(document.id),
      documentSnapshots.findDocumentSnapshot(document.id),
    ]);
    const relatedById = new Map(relatedDocs.map((item) => [item.id, item]));
    const ledgerOperationsById = await ledgerReadService.listOperationDetails(
      operations.map((operation) => operation.operationId),
    );
    const ledgerOperations = operations.map(
      (operation) => ledgerOperationsById.get(operation.operationId) ?? null,
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
      operations.find((operation) => operation.kind === "post")
        ?.operationId ?? null;
    const allowedActions = await resolveDocumentAllowedActionsForActor({
      accountingPeriods,
      moduleRuntime,
      registry,
      policy,
      log,
      now,
      actorUserId,
      document,
    });

    return {
      document,
      dealId,
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
      documentOperations: operations,
      ledgerOperations,
      computed: details?.computed,
      extra: details?.extra,
    };
  };
}
