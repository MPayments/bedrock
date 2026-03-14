import { DocumentNotFoundError } from "../../errors";
import type { DocumentWithOperationId } from "../../types";
import {
  buildDocumentWithOperationId,
  resolveDocumentAllowedActionsForActor,
} from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";

export function createGetDocumentQuery(context: DocumentsServiceContext) {
  const { accountingPeriods, log, moduleDb, policy, registry, repository } =
    context;

  return async function getDocument(
    docType: string,
    documentId: string,
    actorUserId?: string,
  ): Promise<DocumentWithOperationId> {
    const row = await repository.findDocumentWithPostingOperation({
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
        moduleDb,
        registry,
        policy,
        log,
        actorUserId,
        document: row.document,
      }),
    };
  };
}
