import type { ModuleRuntime } from "@bedrock/shared/core";
import { InvalidStateError } from "@bedrock/shared/core/errors";

import type { PreparedDocumentPosting } from "./types";
import { Document } from "../../../documents/domain/document";
import type { DocumentTransitionInput } from "../../../lifecycle/application/contracts/commands";
import { loadDocumentOrThrow } from "../../../lifecycle/application/shared/actions";
import {
  assertOrganizationPeriodsOpenForDocument,
} from "../../../shared/application/action-runtime";
import { buildDocumentEventState } from "../../../shared/application/document-event-state";
import type {
  DocumentsAccountingPeriodsPort,
  PostingCommandUnitOfWork,
} from "../ports";

export class PrepareDocumentRepostCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: PostingCommandUnitOfWork,
    private readonly accountingPeriods: DocumentsAccountingPeriodsPort,
  ) {}

  async execute(
    input: DocumentTransitionInput,
  ): Promise<PreparedDocumentPosting> {
    return this.commandUow.run(
      async ({ documentsCommand, documentOperations }) => {
        this.runtime.log.debug("documents repost requested", {
          documentId: input.documentId,
          docType: input.docType,
        });

        const document = await loadDocumentOrThrow(documentsCommand, {
          documentId: input.documentId,
          docType: input.docType,
          forUpdate: true,
        });

        await assertOrganizationPeriodsOpenForDocument({
          accountingPeriods: this.accountingPeriods,
          document,
          docType: input.docType,
        });

        const operationId = await documentOperations.findPostingOperationId({
          documentId: document.id,
        });
        if (!operationId) {
          throw new InvalidStateError(
            "Failed document does not have a posting operation to repost",
          );
        }

        await documentOperations.resetPostingOperation({ operationId });

        const before = buildDocumentEventState(document);
        const nextDocument = Document.fromSnapshot(document)
          .resetForRepost({
            now: this.runtime.now(),
          })
          .toSnapshot();

        const stored = await documentsCommand.updateDocument({
          documentId: document.id,
          docType: input.docType,
          patch: {
            postingStatus: nextDocument.postingStatus,
            postingStartedAt: nextDocument.postingStartedAt,
            postingError: nextDocument.postingError,
            updatedAt: nextDocument.updatedAt,
          },
        });

        if (!stored) {
          throw new InvalidStateError("Failed to repost document");
        }

        return {
          action: "repost",
          docType: input.docType,
          document: stored,
          actorUserId: input.actorUserId,
          requestContext: input.requestContext,
          postingOperationId: operationId,
          successEvents: [],
          finalEvent: {
            eventType: "repost",
            before,
            after: buildDocumentEventState(stored),
          },
        };
      },
    );
  }
}
