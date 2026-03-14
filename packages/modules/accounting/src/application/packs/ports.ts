import type { CompiledPack } from "../../domain/packs";

export interface StoredCompiledPackRow {
  checksum: string;
  compiledJson: Record<string, unknown>;
}

export interface AccountingCompiledPackCache {
  read: (key: string) => CompiledPack | null | undefined;
  write: (key: string, value: CompiledPack | null) => void;
}

export interface AccountingPacksRepository {
  findPackVersion: (input: {
    packKey: string;
    version: number;
  }) => Promise<StoredCompiledPackRow | null>;
  insertPackVersion: (input: {
    packKey: string;
    version: number;
    checksum: string;
    compiledJson: Record<string, unknown>;
  }) => Promise<void>;
  updatePackVersion: (input: {
    packKey: string;
    version: number;
    checksum: string;
    compiledJson: Record<string, unknown>;
    compiledAt: Date;
  }) => Promise<void>;
  hasAssignmentsForPackChecksum: (checksum: string) => Promise<boolean>;
  findPackByChecksum: (
    checksum: string,
  ) => Promise<StoredCompiledPackRow | null>;
  insertPackAssignment: (input: {
    scopeType: string;
    scopeId: string;
    packChecksum: string;
    effectiveAt: Date;
  }) => Promise<void>;
  findActivePackAssignment: (input: {
    scopeType: string;
    scopeId: string;
    effectiveAt: Date;
  }) => Promise<{ packChecksum: string } | null>;
}

export interface AccountingPacksServicePorts {
  repository?: AccountingPacksRepository;
  cache?: AccountingCompiledPackCache;
  withTransaction?: <T>(
    run: (repository: AccountingPacksRepository) => Promise<T>,
  ) => Promise<T>;
  assertBooksBelongToInternalLedgerOrganizations?: (
    bookIds: string[],
  ) => Promise<void>;
}
