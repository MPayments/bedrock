import type { DocumentSnapshot } from "../../domain/document";
import type { ListDocumentsQuery } from "../contracts/queries";

export interface FindDocumentByTypeQueryInput {
  documentId: string;
  docType: string;
}

export interface DocumentWithPostingOperationRow {
  document: DocumentSnapshot;
  postingOperationId: string | null;
}

export interface FindDocumentWithPostingOperationInput {
  documentId: string;
  docType: string;
}

export interface DocumentsQueryRepository {
  findDocumentByType(
    input: FindDocumentByTypeQueryInput,
  ): Promise<DocumentSnapshot | null>;
  findDocumentWithPostingOperation(
    input: FindDocumentWithPostingOperationInput,
  ): Promise<DocumentWithPostingOperationRow | null>;
  listDocuments(input: ListDocumentsQuery): Promise<{
    rows: DocumentWithPostingOperationRow[];
    total: number;
  }>;
  listDocumentsByIds(documentIds: string[]): Promise<DocumentSnapshot[]>;
}
