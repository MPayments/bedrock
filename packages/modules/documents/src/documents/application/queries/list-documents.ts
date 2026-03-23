import type { ModuleRuntime } from "@bedrock/shared/core";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import {
  buildDocumentWithOperationId,
  resolveDocumentsAllowedActionsForActor,
} from "../../../lifecycle/application/shared/actions";
import type {
  DocumentActionPolicyService,
  DocumentModuleRuntime,
  DocumentRegistry,
} from "../../../plugins";
import type { DocumentsAccountingPeriodsPort } from "../../../posting/application/ports";
import type { DocumentWithOperationId } from "../contracts/dto";
import {
  ListDocumentsQuerySchema,
  type ListDocumentsQuery as ListDocumentsQueryInput,
} from "../contracts/queries";
import type { DocumentsQueryRepository } from "../ports";

export class ListDocumentsQuery {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly documentsQuery: DocumentsQueryRepository,
    private readonly accountingPeriods: DocumentsAccountingPeriodsPort,
    private readonly moduleRuntime: DocumentModuleRuntime,
    private readonly registry: DocumentRegistry,
    private readonly policy: DocumentActionPolicyService,
  ) {}

  async execute(
    input?: ListDocumentsQueryInput,
    actorUserId?: string,
  ): Promise<PaginatedList<DocumentWithOperationId>> {
    const query = ListDocumentsQuerySchema.parse(input ?? {});
    const { rows, total } = await this.documentsQuery.listDocuments(query);
    const allowedActionsByDocumentId = actorUserId
      ? await resolveDocumentsAllowedActionsForActor({
          accountingPeriods: this.accountingPeriods,
          moduleRuntime: this.moduleRuntime,
          registry: this.registry,
          policy: this.policy,
          log: this.runtime.log,
          now: this.runtime.now,
          actorUserId,
          documents: rows.map((row) => row.document),
        })
      : null;

    const data = actorUserId
      ? rows.map((row) => ({
          ...buildDocumentWithOperationId({
            registry: this.registry,
            document: row.document,
            postingOperationId: row.postingOperationId,
          }),
          allowedActions: allowedActionsByDocumentId?.get(row.document.id) ?? [],
        }))
      : rows.map((row) =>
          buildDocumentWithOperationId({
            registry: this.registry,
            document: row.document,
            postingOperationId: row.postingOperationId,
          }),
        );

    return {
      data,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }
}
