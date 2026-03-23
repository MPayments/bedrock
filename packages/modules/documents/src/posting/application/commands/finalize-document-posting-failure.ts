import type { ModuleRuntime } from "@bedrock/shared/core";
import { InvalidStateError } from "@bedrock/shared/core/errors";

import type { FinalizeFailedDocumentPostingInput } from "./types";
import { Document } from "../../../documents/domain/document";
import { buildDocumentWithOperationId } from "../../../lifecycle/application/shared/actions";
import type { DocumentRegistry } from "../../../plugins";
import {
  buildDocumentActionEvent,
  insertDocumentEvents,
} from "../../../shared/application/action-runtime";
import { buildDocumentEventState } from "../../../shared/application/document-event-state";
import type { PostingCommandUnitOfWork } from "../ports";

export class FinalizeDocumentPostingFailureCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: PostingCommandUnitOfWork,
    private readonly registry: DocumentRegistry,
  ) {}

  async execute(
    input: FinalizeFailedDocumentPostingInput,
  ) {
    return this.commandUow.run(
      async ({ documentEvents, documentsCommand }) => {
        const failed = Document.fromSnapshot(input.prepared.document)
          .completePosting({
            status: "failed",
            now: this.runtime.now(),
            error: input.error,
          })
          .toSnapshot();

        const stored = await documentsCommand.updateDocument({
          documentId: input.prepared.document.id,
          docType: input.prepared.docType,
          patch: {
            postingStatus: failed.postingStatus,
            postedAt: failed.postedAt,
            postingError: failed.postingError,
            updatedAt: failed.updatedAt,
          },
        });

        if (!stored) {
          throw new InvalidStateError("Failed to mark document posting as failed");
        }

        await insertDocumentEvents({
          documentEvents,
          events: input.prepared.successEvents,
          documentId: stored.id,
          actorUserId: input.prepared.actorUserId,
          requestContext: input.prepared.requestContext,
        });

        await insertDocumentEvents({
          documentEvents,
          events: [
            buildDocumentActionEvent({
              eventType: "posting_failed",
              before: buildDocumentEventState(input.prepared.document),
              after: buildDocumentEventState(stored),
              reasonMeta: {
                error: input.error,
                ...(input.operationId ? { operationId: input.operationId } : {}),
              },
            }),
          ],
          documentId: stored.id,
          actorUserId: input.prepared.actorUserId,
          requestContext: input.prepared.requestContext,
        });

        return buildDocumentWithOperationId({
          registry: this.registry,
          document: stored,
          postingOperationId: input.operationId ?? null,
        });
      },
    );
  }
}
