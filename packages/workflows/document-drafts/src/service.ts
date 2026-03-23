import type { DocumentsModule } from "@bedrock/documents";
import type { Database, Transaction } from "@bedrock/platform/persistence";

type DocumentDraftCommand = DocumentsModule["documents"]["commands"]["createDraft"];

export interface DocumentDraftCommandsModule {
  documents: {
    commands: Pick<DocumentsModule["documents"]["commands"], "createDraft">;
  };
}

export type CreateDocumentDraftModule = (
  tx: Transaction,
) => DocumentDraftCommandsModule;

export interface DocumentDraftWorkflowDeps {
  db: Database;
  createDocumentsModule: CreateDocumentDraftModule;
}

export interface DocumentDraftWorkflow {
  createDraft(
    input: Parameters<DocumentDraftCommand>[0],
  ): ReturnType<DocumentDraftCommand>;
}

export function createDocumentDraftWorkflow(
  deps: DocumentDraftWorkflowDeps,
): DocumentDraftWorkflow {
  return {
    async createDraft(input) {
      return deps.db.transaction(async (tx) => {
        const documentsModule = deps.createDocumentsModule(tx);
        return documentsModule.documents.commands.createDraft(input);
      });
    },
  };
}
