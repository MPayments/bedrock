import type { Database } from "@bedrock/db";
import type { Logger } from "@bedrock/kernel";

export const MODULE_SCOPE_GLOBAL_ID = "__global__";
export const DEFAULT_RETRY_AFTER_SEC = 300;
export const MIN_RETRY_AFTER_SEC = 30;
export const MAX_RETRY_AFTER_SEC = 3_600;

export type ModuleState = "enabled" | "disabled";
export type ModuleScopeType = "global" | "book";

export interface ModuleDependency {
  moduleId: string;
  required: true;
  reason: string;
}

export interface ModuleManifest {
  id: string;
  version: number;
  description: string;
  enabledByDefault: boolean;
  mutable?: boolean;
  dependencies: ModuleDependency[];
}

export interface ModuleRuntimeServiceDeps {
  db: Database;
  logger?: Logger;
  manifests: ModuleManifest[];
  cacheTtlMs?: number;
  epochPollIntervalMs?: number;
  pgListenChannel?: string;
}

export interface ModuleStateUpdateInput {
  moduleId: string;
  scopeType: ModuleScopeType;
  scopeId?: string;
  state: ModuleState;
  reason: string;
  retryAfterSec?: number;
  expectedVersion: number;
  changedBy: string;
  requestId?: string | null;
}

export interface ModuleStateListInput {
  moduleId?: string;
  scopeType?: ModuleScopeType;
  scopeId?: string;
  limit?: number;
  offset?: number;
}

export interface ModuleRuntimeInfo {
  stateEpoch: bigint;
  manifestChecksum: string;
  manifestSeenVersion: number;
  updatedAt: Date;
  checksumMatches: boolean;
  mixedDeploy: boolean;
}

export interface EffectiveStateScope {
  scopeType: ModuleScopeType;
  scopeId: string;
}

export interface EffectiveModuleState {
  moduleId: string;
  state: ModuleState;
  source: "default" | "global" | "book" | "dependency";
  reason: string | null;
  retryAfterSec: number;
  scope: EffectiveStateScope;
  dependencyChain: string[];
  manifestVersion: number;
}

export interface ListModulesInput {
  bookId?: string;
}

export interface ListModuleEventsInput {
  moduleId?: string;
  scopeType?: ModuleScopeType;
  scopeId?: string;
  limit?: number;
  offset?: number;
}

export interface ModuleStateEventRecord {
  id: string;
  moduleId: string;
  scopeType: ModuleScopeType;
  scopeId: string;
  previousState: ModuleState | null;
  newState: ModuleState;
  reason: string;
  retryAfterSec: number;
  changedBy: string;
  changedAt: Date;
  requestId: string | null;
  meta: Record<string, unknown> | null;
}

export interface ModuleStateRecord {
  id: string;
  moduleId: string;
  scopeType: ModuleScopeType;
  scopeId: string;
  state: ModuleState;
  reason: string;
  retryAfterSec: number;
  version: number;
  changedBy: string;
  changedAt: Date;
}

export interface ModuleCatalogEntry {
  manifest: ModuleManifest;
  effective: EffectiveModuleState;
  globalState: ModuleStateRecord | null;
  bookState: ModuleStateRecord | null;
}

export interface ModuleRuntimeService {
  startBackgroundSync: () => Promise<void>;
  stopBackgroundSync: () => Promise<void>;
  getRuntimeInfo: () => Promise<ModuleRuntimeInfo>;
  listModules: (input?: ListModulesInput) => Promise<ModuleCatalogEntry[]>;
  getEffectiveState: (input: {
    moduleId: string;
    bookId?: string;
  }) => Promise<EffectiveModuleState>;
  isModuleEnabled: (input: {
    moduleId: string;
    bookId?: string;
  }) => Promise<boolean>;
  assertModuleEnabled: (input: {
    moduleId: string;
    bookId?: string;
  }) => Promise<void>;
  updateModuleState: (
    input: ModuleStateUpdateInput,
  ) => Promise<ModuleStateRecord>;
  listModuleEvents: (
    input?: ListModuleEventsInput,
  ) => Promise<ModuleStateEventRecord[]>;
  listModuleStates: (
    input?: ModuleStateListInput,
  ) => Promise<ModuleStateRecord[]>;
  validateGraph: () => void;
  manifests: ModuleManifest[];
  manifestChecksum: string;
}
