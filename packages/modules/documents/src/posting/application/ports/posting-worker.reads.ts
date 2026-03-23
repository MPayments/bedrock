import type { DocumentSnapshot } from "../../../documents/domain/document";

export interface DocumentPostingWorkerItem {
  document: DocumentSnapshot;
  operationId: string;
  ledgerStatus: "posted" | "failed";
  postedAt: Date | null;
  error: string | null;
}

export interface DocumentsPostingWorkerReads {
  claimPostingResults(input: {
    limit: number;
  }): Promise<DocumentPostingWorkerItem[]>;
  listOperationBookIds(
    operationIds: string[],
  ): Promise<Map<string, string[]>>;
}
