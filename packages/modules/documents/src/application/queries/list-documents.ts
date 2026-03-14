import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { DocumentWithOperationId } from "../../contracts/service";
import {
  ListDocumentsQuerySchema,
  type ListDocumentsQuery,
} from "../../contracts/validation";
import {
  buildDocumentWithOperationId,
  resolveDocumentAllowedActionsForActor,
} from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";

export function createListDocumentsQuery(context: DocumentsServiceContext) {
  const { accountingPeriods, log, moduleRuntime, policy, registry, repository } =
    context;

  return async function listDocuments(
    input?: ListDocumentsQuery,
    actorUserId?: string,
  ): Promise<PaginatedList<DocumentWithOperationId>> {
    const query = ListDocumentsQuerySchema.parse(input ?? {});
    const { rows, total } = await repository.listDocuments(query);

    const data = actorUserId
      ? await Promise.all(
          rows.map(async (row) => {
            const base = buildDocumentWithOperationId({
              registry,
              document: row.document,
              postingOperationId: row.postingOperationId,
            });

            return {
              ...base,
              allowedActions: await resolveDocumentAllowedActionsForActor({
                accountingPeriods,
                moduleRuntime,
                registry,
                policy,
                log,
                actorUserId,
                document: row.document,
              }),
            };
          }),
        )
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
