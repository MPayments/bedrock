import type { ModuleRuntime } from "@bedrock/shared/core";

import { DocumentNotFoundError } from "../../../errors";
import { resolveDocumentAllowedActionsForActor } from "../../../lifecycle/application/shared/actions";
import type {
  DocumentActionPolicyService,
  DocumentModuleRuntime,
  DocumentRegistry,
} from "../../../plugins";
import type { DocumentsAccountingPeriodsPort, DocumentsLedgerReadPort } from "../../../posting/application/ports";
import {
  createModuleContext,
  resolveModuleForDocument,
} from "../../../shared/application/module-resolution";
import type { DocumentDetails } from "../contracts/dto";
import type {
  DocumentEventsRepository,
  DocumentLinksRepository,
  DocumentOperationsRepository,
  DocumentSnapshotsRepository,
  DocumentsQueryRepository,
} from "../ports";

export class GetDocumentDetailsQuery {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly accountingPeriods: DocumentsAccountingPeriodsPort,
    private readonly documentEvents: Pick<DocumentEventsRepository, "listDocumentEvents">,
    private readonly documentLinks: Pick<DocumentLinksRepository, "listDocumentLinks">,
    private readonly documentOperations: Pick<
      DocumentOperationsRepository,
      "listDocumentOperations"
    >,
    private readonly documentSnapshots: Pick<
      DocumentSnapshotsRepository,
      "findDocumentSnapshot"
    >,
    private readonly documentsQuery: DocumentsQueryRepository,
    private readonly ledgerReadService: DocumentsLedgerReadPort,
    private readonly moduleRuntime: DocumentModuleRuntime,
    private readonly registry: DocumentRegistry,
    private readonly policy: DocumentActionPolicyService,
  ) {}

  async execute(
    docType: string,
    documentId: string,
    actorUserId = "system",
  ): Promise<DocumentDetails> {
    const document = await this.documentsQuery.findDocumentByType({
      documentId,
      docType,
    });

    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    let module = null;
    try {
      module = resolveModuleForDocument(this.registry, document);
    } catch (error) {
      this.runtime.log.warn("documents get details: module resolution failed", {
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
          now: this.runtime.now(),
          log: this.runtime.log,
          operationIdempotencyKey: null,
          runtime: this.moduleRuntime,
        })
      : null;

    const links = await this.documentLinks.listDocumentLinks(document.id);
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
        (link) => link.toDocumentId === document.id && link.linkType === "parent",
      )
      .map((link) => link.fromDocumentId);

    const relatedIds = Array.from(
      new Set([...parentIds, ...dependsOnIds, ...compensatesIds, ...childIds]),
    );
    const [relatedDocs, operations, events, snapshot] = await Promise.all([
      this.documentsQuery.listDocumentsByIds(relatedIds),
      this.documentOperations.listDocumentOperations(document.id),
      this.documentEvents.listDocumentEvents(document.id),
      this.documentSnapshots.findDocumentSnapshot(document.id),
    ]);
    const relatedById = new Map(relatedDocs.map((item) => [item.id, item]));
    const ledgerOperationsById = await this.ledgerReadService.listOperationDetails(
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
        this.runtime.log.warn("documents get details: failed to build module details", {
          docType,
          documentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const postingOperationId =
      operations.find((operation) => operation.kind === "post")?.operationId ??
      null;
    const allowedActions = await resolveDocumentAllowedActionsForActor({
      accountingPeriods: this.accountingPeriods,
      moduleRuntime: this.moduleRuntime,
      registry: this.registry,
      policy: this.policy,
      log: this.runtime.log,
      now: this.runtime.now,
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
      documentOperations: operations,
      ledgerOperations,
      computed: details?.computed,
      extra: details?.extra,
    };
  }
}
