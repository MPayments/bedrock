import type { DocumentOperation } from "../../domain/document";

export interface FindPostingOperationIdInput {
  documentId: string;
}

export interface InsertDocumentOperationInput {
  documentId: string;
  operationId: string;
  kind: string;
}

export interface ResetPostingOperationInput {
  operationId: string;
}

export interface DocumentOperationsRepository {
  findPostingOperationId(
    input: FindPostingOperationIdInput,
  ): Promise<string | null>;
  insertDocumentOperation(input: InsertDocumentOperationInput): Promise<void>;
  resetPostingOperation(input: ResetPostingOperationInput): Promise<void>;
  listDocumentOperations(documentId: string): Promise<DocumentOperation[]>;
}
