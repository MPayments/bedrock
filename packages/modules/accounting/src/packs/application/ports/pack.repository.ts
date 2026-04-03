import type { StoredCompiledPackRow } from "./pack.reads";

export interface PackRepository {
  findVersion(input: {
    packKey: string;
    version: number;
  }): Promise<StoredCompiledPackRow | null>;
  insertVersion(input: {
    packKey: string;
    version: number;
    checksum: string;
    compiledJson: Record<string, unknown>;
  }): Promise<void>;
  updateVersion(input: {
    packKey: string;
    version: number;
    checksum: string;
    compiledJson: Record<string, unknown>;
    compiledAt: Date;
  }): Promise<void>;
  hasAssignmentsForChecksum(input: { checksum: string }): Promise<boolean>;
  insertAssignment(input: {
    scopeType: string;
    scopeId: string;
    packChecksum: string;
    effectiveAt: Date;
  }): Promise<void>;
}
