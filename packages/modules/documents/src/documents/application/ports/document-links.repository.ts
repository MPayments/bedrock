import type {
  DocumentInitialLink,
  DocumentLink,
  DocumentSnapshot,
} from "../../domain/document";

export interface InsertInitialDocumentLinksInput {
  document: DocumentSnapshot;
  links: DocumentInitialLink[];
}

export interface DocumentLinksRepository {
  insertInitialLinks(input: InsertInitialDocumentLinksInput): Promise<void>;
  listDocumentLinks(documentId: string): Promise<DocumentLink[]>;
}
