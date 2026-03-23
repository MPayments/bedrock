import type { ModuleRuntime } from "@bedrock/shared/core";

import { DocumentNotFoundError } from "../../../errors";
import {
  buildDocumentWithOperationId,
  resolveDocumentAllowedActionsForActor,
} from "../../../lifecycle/application/shared/actions";
import type {
  DocumentActionPolicyService,
  DocumentModuleRuntime,
  DocumentRegistry,
} from "../../../plugins";
import type { DocumentsAccountingPeriodsPort } from "../../../posting/application/ports";
import type { DocumentWithOperationId } from "../contracts/dto";
import type { DocumentsQueryRepository } from "../ports";

export class GetDocumentQuery {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly documentsQuery: DocumentsQueryRepository,
    private readonly accountingPeriods: DocumentsAccountingPeriodsPort,
    private readonly moduleRuntime: DocumentModuleRuntime,
    private readonly registry: DocumentRegistry,
    private readonly policy: DocumentActionPolicyService,
  ) {}

  async execute(
    docType: string,
    documentId: string,
    actorUserId?: string,
  ): Promise<DocumentWithOperationId> {
    const row = await this.documentsQuery.findDocumentWithPostingOperation({
      documentId,
      docType,
    });

    if (!row) {
      throw new DocumentNotFoundError(documentId);
    }

    const result = buildDocumentWithOperationId({
      registry: this.registry,
      document: row.document,
      postingOperationId: row.postingOperationId,
    });

    if (!actorUserId) {
      return result;
    }

    return {
      ...result,
      allowedActions: await resolveDocumentAllowedActionsForActor({
        accountingPeriods: this.accountingPeriods,
        moduleRuntime: this.moduleRuntime,
        registry: this.registry,
        policy: this.policy,
        log: this.runtime.log,
        now: this.runtime.now,
        actorUserId,
        document: row.document,
      }),
    };
  }
}
