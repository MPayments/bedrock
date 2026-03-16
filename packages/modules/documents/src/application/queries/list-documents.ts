import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { DocumentWithOperationId } from "../../contracts/dto";
import {
  ListDocumentsQuerySchema,
  type ListDocumentsQuery,
} from "../../contracts/queries";
import {
  buildDocumentWithOperationId,
  resolveDocumentsAllowedActionsForActor,
} from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";

export function createListDocumentsQuery(context: DocumentsServiceContext) {
  const {
    accountingPeriods,
    documentsQuery,
    log,
    moduleRuntime,
    now,
    policy,
    registry,
  } = context;

  return async function listDocuments(
    input?: ListDocumentsQuery,
    actorUserId?: string,
  ): Promise<PaginatedList<DocumentWithOperationId>> {
    const query = ListDocumentsQuerySchema.parse(input ?? {});
    const { rows, total } = await documentsQuery.listDocuments(query);
    const allowedActionsByDocumentId = actorUserId
      ? await resolveDocumentsAllowedActionsForActor({
          accountingPeriods,
          moduleRuntime,
          registry,
          policy,
          log,
          now,
          actorUserId,
          documents: rows.map((row) => row.document),
        })
      : null;

    const data = actorUserId
      ? rows.map((row) => ({
          ...buildDocumentWithOperationId({
            registry,
            document: row.document,
            postingOperationId: row.postingOperationId,
          }),
          allowedActions: allowedActionsByDocumentId?.get(row.document.id) ?? [],
        }))
      : rows.map((row) =>
          buildDocumentWithOperationId({
            registry,
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
  };
}
