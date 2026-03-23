import type { FinalizePreparedDocumentPostingInput } from "./types";
import { buildDocumentWithOperationId } from "../../../lifecycle/application/shared/actions";
import type { DocumentRegistry } from "../../../plugins";
import { buildDocumentActionEvent, insertDocumentEvents } from "../../../shared/application/action-runtime";
import type { PostingCommandUnitOfWork } from "../ports";

export class FinalizeDocumentPostingSuccessCommand {
  constructor(
    private readonly commandUow: PostingCommandUnitOfWork,
    private readonly registry: DocumentRegistry,
  ) {}

  async execute(
    input: FinalizePreparedDocumentPostingInput,
  ) {
    return this.commandUow.run(
      async ({ documentEvents, documentOperations }) => {
        await documentOperations.insertDocumentOperation({
          documentId: input.prepared.document.id,
          operationId: input.operationId,
          kind: "post",
        });

        await insertDocumentEvents({
          documentEvents,
          events: input.prepared.successEvents,
          documentId: input.prepared.document.id,
          actorUserId: input.prepared.actorUserId,
          requestContext: input.prepared.requestContext,
        });

        await insertDocumentEvents({
          documentEvents,
          events: [
            buildDocumentActionEvent({
              eventType: input.prepared.finalEvent.eventType,
              before: input.prepared.finalEvent.before,
              after: input.prepared.finalEvent.after,
              reasonMeta: {
                operationId: input.operationId,
                ...(input.prepared.finalEvent.reasonMeta ?? {}),
              },
            }),
          ],
          documentId: input.prepared.document.id,
          actorUserId: input.prepared.actorUserId,
          requestContext: input.prepared.requestContext,
        });

        return buildDocumentWithOperationId({
          registry: this.registry,
          document: input.prepared.document,
          postingOperationId: input.operationId,
        });
      },
    );
  }
}
