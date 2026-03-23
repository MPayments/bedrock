import type { DocumentSnapshot } from "../../domain/document";

export interface FindDocumentByTypeCommandInput {
  documentId: string;
  docType: string;
  forUpdate?: boolean;
}

export interface FindDocumentByCreateIdempotencyKeyInput {
  docType: string;
  createIdempotencyKey: string;
}

export interface UpdateDocumentInput {
  documentId: string;
  docType: string;
  patch: Partial<DocumentSnapshot> & Record<string, unknown>;
}

export interface DocumentsCommandRepository {
  findDocumentByType(
    input: FindDocumentByTypeCommandInput,
  ): Promise<DocumentSnapshot | null>;
  findDocumentByCreateIdempotencyKey(
    input: FindDocumentByCreateIdempotencyKeyInput,
  ): Promise<DocumentSnapshot | null>;
  insertDocument(document: DocumentSnapshot): Promise<DocumentSnapshot | null>;
  updateDocument(input: UpdateDocumentInput): Promise<DocumentSnapshot | null>;
}
