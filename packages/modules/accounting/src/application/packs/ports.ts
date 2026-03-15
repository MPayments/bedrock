import type { CompiledPack } from "../../domain/packs";

export interface StoredCompiledPackRow {
  checksum: string;
  compiledJson: Record<string, unknown>;
}

export interface AccountingPacksCommandTransaction {
  readonly _accountingPacksTransaction: "AccountingPacksCommandTransaction";
}

export interface AccountingCompiledPackCache {
  read: (key: string) => CompiledPack | null | undefined;
  write: (key: string, value: CompiledPack | null) => void;
}

export interface AccountingPacksQueryRepository {
  findPackByChecksum: (
    checksum: string,
  ) => Promise<StoredCompiledPackRow | null>;
  findActivePackAssignment: (input: {
    scopeType: string;
    scopeId: string;
    effectiveAt: Date;
  }) => Promise<{ packChecksum: string } | null>;
}

export interface AccountingPacksCommandRepository {
  findPackVersion: (input: {
    packKey: string;
    version: number;
    tx: AccountingPacksCommandTransaction;
  }) => Promise<StoredCompiledPackRow | null>;
  insertPackVersion: (input: {
    packKey: string;
    version: number;
    checksum: string;
    compiledJson: Record<string, unknown>;
    tx: AccountingPacksCommandTransaction;
  }) => Promise<void>;
  updatePackVersion: (input: {
    packKey: string;
    version: number;
    checksum: string;
    compiledJson: Record<string, unknown>;
    compiledAt: Date;
    tx: AccountingPacksCommandTransaction;
  }) => Promise<void>;
  hasAssignmentsForPackChecksum: (input: {
    checksum: string;
    tx: AccountingPacksCommandTransaction;
  }) => Promise<boolean>;
  insertPackAssignment: (input: {
    scopeType: string;
    scopeId: string;
    packChecksum: string;
    effectiveAt: Date;
    tx: AccountingPacksCommandTransaction;
  }) => Promise<void>;
}

export interface AccountingPacksServicePorts {
  queries?: AccountingPacksQueryRepository;
  commands?: AccountingPacksCommandRepository;
  cache?: AccountingCompiledPackCache;
  now?: () => Date;
  runInTransaction?: <T>(
    run: (tx: AccountingPacksCommandTransaction) => Promise<T>,
  ) => Promise<T>;
  assertBooksBelongToInternalLedgerOrganizations?: (
    bookIds: string[],
  ) => Promise<void>;
}
