import type { DocumentPostingSnapshot } from "../../domain/document";

export type InsertDocumentPostingSnapshotInput = Omit<
  DocumentPostingSnapshot,
  "id" | "createdAt"
>;

export interface DocumentSnapshotsRepository {
  findDocumentSnapshot(
    documentId: string,
  ): Promise<DocumentPostingSnapshot | null>;
  insertDocumentSnapshot(snapshot: InsertDocumentPostingSnapshotInput): Promise<void>;
}
