import type {
  DocumentEventsRepository,
  InsertDocumentPostingSnapshotInput,
} from "../../../documents/application/ports";
import type {
  DocumentPostingSnapshot,
} from "../../../documents/domain/document";
import { Document } from "../../../documents/domain/document";
import { buildDocumentEventState } from "../../../shared/application/document-event-state";
import type {
  DocumentsPostingWorkerReads,
} from "../ports/posting-worker.reads";
import type {
  DocumentsPostingWorkerUnitOfWork,
} from "../ports/posting-worker.uow";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildPostingSnapshot(input: {
  document: Pick<
    InsertDocumentPostingSnapshotInput,
    "documentId" | "payload" | "payloadVersion" | "moduleId" | "moduleVersion"
  >;
  artifacts: Record<string, unknown>;
}): InsertDocumentPostingSnapshotInput {
  const postingPlan = asRecord(input.artifacts.postingPlan) ?? {};
  const journalIntent = asRecord(input.artifacts.journalIntent) ?? {};

  return {
    documentId: input.document.documentId,
    payload: input.document.payload,
    payloadVersion: input.document.payloadVersion,
    moduleId: input.document.moduleId,
    moduleVersion: input.document.moduleVersion,
    packChecksum: String(input.artifacts.packChecksum ?? ""),
    postingPlanChecksum: String(input.artifacts.postingPlanChecksum ?? ""),
    journalIntentChecksum: String(input.artifacts.journalIntentChecksum ?? ""),
    postingPlan,
    journalIntent,
    resolvedTemplates: Array.isArray(input.artifacts.resolvedTemplates)
      ? input.artifacts.resolvedTemplates
      : null,
  };
}

export class FinalizePostingResultsCommand {
  constructor(
    private readonly reads: DocumentsPostingWorkerReads,
    private readonly uow: DocumentsPostingWorkerUnitOfWork,
  ) {}

  async execute(input: {
    batchSize: number;
    now: Date;
    beforeDocument?: (input: {
      documentId: string;
      operationId: string;
      moduleId: string;
      bookIds: string[];
    }) => Promise<boolean> | boolean;
  }) {
    const claimed = await this.reads.claimPostingResults({
      limit: input.batchSize,
    });
    if (claimed.length === 0) {
      return 0;
    }

    const operationBookIds = await this.reads.listOperationBookIds(
      claimed.map((item) => item.operationId),
    );

    let processed = 0;
    for (const item of claimed) {
      if (input.beforeDocument) {
        const isEnabled = await input.beforeDocument({
          documentId: item.document.id,
          operationId: item.operationId,
          moduleId: item.document.moduleId,
          bookIds: operationBookIds.get(item.operationId) ?? [],
        });
        if (!isEnabled) {
          continue;
        }
      }

      const finalized = await this.uow.run(
        async ({ documentEvents, documentSnapshots, documentsCommand }) => {
          const before = buildDocumentEventState(item.document);
          const completed = Document.fromSnapshot(item.document)
            .completePosting({
              status: item.ledgerStatus,
              now: input.now,
              postedAt: item.postedAt,
              error: item.error,
            })
            .toSnapshot();

          const stored = await documentsCommand.updateDocument({
            documentId: item.document.id,
            docType: item.document.docType,
            patch: {
              postingStatus: completed.postingStatus,
              postedAt: completed.postedAt,
              postingError: completed.postingError,
              updatedAt: completed.updatedAt,
            },
          });

          if (!stored) {
            return false;
          }

          if (item.ledgerStatus === "posted") {
            await this.insertPostingSnapshot({
              documentEvents,
              documentSnapshots,
              document: {
                documentId: stored.id,
                payload: stored.payload,
                payloadVersion: stored.payloadVersion,
                moduleId: stored.moduleId,
                moduleVersion: stored.moduleVersion,
              },
            });
          }

          await documentEvents.insertDocumentEvent({
            documentId: stored.id,
            eventType:
              item.ledgerStatus === "posted" ? "posted" : "posting_failed",
            before,
            after: buildDocumentEventState(stored),
            reasonMeta:
              item.ledgerStatus === "failed"
                ? { operationId: item.operationId, error: item.error }
                : { operationId: item.operationId },
          });

          return true;
        },
      );

      if (finalized) {
        processed += 1;
      }
    }

    return processed;
  }

  private async insertPostingSnapshot(input: {
    documentEvents: DocumentEventsRepository;
    documentSnapshots: {
      findDocumentSnapshot(documentId: string): Promise<DocumentPostingSnapshot | null>;
      insertDocumentSnapshot(snapshot: InsertDocumentPostingSnapshotInput): Promise<void>;
    };
    document: Pick<
      InsertDocumentPostingSnapshotInput,
      "documentId" | "payload" | "payloadVersion" | "moduleId" | "moduleVersion"
    >;
  }) {
    const existing = await input.documentSnapshots.findDocumentSnapshot(
      input.document.documentId,
    );
    if (existing) {
      return;
    }

    const artifacts = await input.documentEvents.getLatestPostingArtifacts(
      input.document.documentId,
    );
    if (!artifacts) {
      return;
    }

    await input.documentSnapshots.insertDocumentSnapshot(
      buildPostingSnapshot({
        document: input.document,
        artifacts,
      }),
    );
  }
}
