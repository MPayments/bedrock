import type { DocumentWithOperationId } from "../../contracts/service";
import { DocumentNotFoundError } from "../../errors";
import {
  buildDocumentWithOperationId,
  resolveDocumentAllowedActionsForActor,
} from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";

export function createGetDocumentQuery(context: DocumentsServiceContext) {
  const {
    accountingPeriods,
    documentsQuery,
    log,
    moduleRuntime,
    now,
    policy,
    registry,
  } = context;

  return async function getDocument(
    docType: string,
    documentId: string,
    actorUserId?: string,
  ): Promise<DocumentWithOperationId> {
    const row = await documentsQuery.findDocumentWithPostingOperation({
      documentId,
      docType,
    });

    if (!row) {
      throw new DocumentNotFoundError(documentId);
    }

    const result = buildDocumentWithOperationId({
      registry,
      document: row.document,
      postingOperationId: row.postingOperationId,
    });

    if (!actorUserId) {
      return result;
    }

    return {
      ...result,
      allowedActions: await resolveDocumentAllowedActionsForActor({
        accountingPeriods,
        moduleRuntime,
        registry,
        policy,
        log,
        now,
        actorUserId,
        document: row.document,
      }),
    };
  };
}
