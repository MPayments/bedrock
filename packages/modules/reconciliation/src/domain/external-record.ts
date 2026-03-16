import { DomainError, Entity } from "@bedrock/shared/core/domain";

export interface ExternalRecordSnapshot {
  id: string;
  source: string;
  sourceRecordId: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  payloadHash: string;
  normalizationVersion: number;
  requestId: string | null;
  correlationId: string | null;
  traceId: string | null;
  causationId: string | null;
  receivedAt: Date;
}

export class ExternalRecord extends Entity<string> {
  private constructor(private readonly snapshot: ExternalRecordSnapshot) {
    super(snapshot.id);
  }

  static fromSnapshot(snapshot: ExternalRecordSnapshot): ExternalRecord {
    return new ExternalRecord({ ...snapshot });
  }

  assertSamePayloadHash(payloadHash: string): void {
    if (this.snapshot.payloadHash !== payloadHash) {
      throw new DomainError(
        "reconciliation.external_record.payload_conflict",
        "external record already exists with different payload",
        {
          source: this.snapshot.source,
          sourceRecordId: this.snapshot.sourceRecordId,
        },
      );
    }
  }
}
