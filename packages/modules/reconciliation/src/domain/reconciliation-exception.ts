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

  static fromSnapshot(
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

  ignore(input: {
    ignoredAt: Date;
  }) {
    if (this.snapshot.state === "ignored") {
      return {
        alreadyIgnored: true,
        exceptionId: this.snapshot.id,
      };
    }

    if (this.snapshot.state === "resolved") {
      return {
        alreadyIgnored: false,
        exceptionId: this.snapshot.id,
        ignoredBlockedByResolution: true as const,
        update: null,
      };
    }

    return {
      alreadyIgnored: false,
      exceptionId: this.snapshot.id,
      ignoredBlockedByResolution: false as const,
      update: {
        id: this.snapshot.id,
        ignoredAt: input.ignoredAt,
      },
    };
  }
}
