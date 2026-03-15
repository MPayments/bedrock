import { Entity } from "@bedrock/shared/core/domain";

export interface ReconciliationExceptionSnapshot {
  id: string;
  runId: string;
  externalRecordId: string;
  adjustmentDocumentId: string | null;
  reasonCode: string;
  reasonMeta: Record<string, unknown> | null;
  state: "open" | "resolved" | "ignored";
  createdAt: Date;
  resolvedAt: Date | null;
}

export class ReconciliationException extends Entity<string> {
  private constructor(
    private readonly snapshot: ReconciliationExceptionSnapshot,
  ) {
    super(snapshot.id);
  }

  static reconstitute(
    snapshot: ReconciliationExceptionSnapshot,
  ): ReconciliationException {
    return new ReconciliationException({ ...snapshot });
  }

  static open(input: {
    runId: string;
    externalRecordId: string;
    reasonCode: string;
    reasonMeta: Record<string, unknown> | null;
  }) {
    return {
      runId: input.runId,
      externalRecordId: input.externalRecordId,
      reasonCode: input.reasonCode,
      reasonMeta: input.reasonMeta,
      state: "open" as const,
    };
  }

  resolveWithAdjustment(input: {
    adjustmentDocumentId: string;
    resolvedAt: Date;
  }) {
    if (this.snapshot.adjustmentDocumentId) {
      return {
        exceptionId: this.snapshot.id,
        documentId: this.snapshot.adjustmentDocumentId,
        alreadyResolved: true,
      };
    }

    return {
      exceptionId: this.snapshot.id,
      documentId: input.adjustmentDocumentId,
      alreadyResolved: false,
      update: {
        id: this.snapshot.id,
        adjustmentDocumentId: input.adjustmentDocumentId,
        resolvedAt: input.resolvedAt,
      },
    };
  }
}
