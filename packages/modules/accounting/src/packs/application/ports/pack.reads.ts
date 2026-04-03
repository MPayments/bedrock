export interface StoredCompiledPackRow {
  checksum: string;
  compiledJson: Record<string, unknown>;
}

export interface PackReads {
  findByChecksum(checksum: string): Promise<StoredCompiledPackRow | null>;
  findActiveAssignment(input: {
    scopeType: string;
    scopeId: string;
    effectiveAt: Date;
  }): Promise<{ packChecksum: string } | null>;
}
