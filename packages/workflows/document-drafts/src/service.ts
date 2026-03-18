import type { DocumentsService } from "@bedrock/documents";
import type { Database, Transaction } from "@bedrock/platform/persistence";

export type CreateDocumentDraftService = (
  tx: Transaction,
) => Pick<DocumentsService, "createDraft">;

export interface DocumentDraftWorkflowDeps {
  db: Database;
  createDocumentsService: CreateDocumentDraftService;
}

export function createDocumentDraftWorkflow(deps: DocumentDraftWorkflowDeps) {
  return {
    async createDraft(
      input: Parameters<
        ReturnType<DocumentDraftWorkflowDeps["createDocumentsService"]>["createDraft"]
      >[0],
    ) {
      return deps.db.transaction(async (tx) => {
        const documents = deps.createDocumentsService(tx);
        return documents.createDraft(input);
      });
    },
  };
}

export type DocumentDraftWorkflow = ReturnType<
  typeof createDocumentDraftWorkflow
>;
