import type { Logger } from "@bedrock/common";
import type { Database } from "@bedrock/common/db/types";

export const MODULE_SCOPE_GLOBAL_ID = "__global__";
export const DEFAULT_RETRY_AFTER_SEC = 300;
export const MIN_RETRY_AFTER_SEC = 30;
export const MAX_RETRY_AFTER_SEC = 3_600;

export type ModuleState = "enabled" | "disabled";
export type ModuleScopeType = "global" | "book";
export type ModuleKind = "kernel" | "domain" | "integration" | "control";
export type ModuleMutability = "immutable" | "mutable";
export type ModuleApiVersion = "v1";

export interface ModuleDependency {
  moduleId: string;
  reason: string;
}

export interface ModuleScopeSupport {
  global: true;
  book: boolean;
}

export interface ModuleApiCapability {
  version: ModuleApiVersion;
  routePath: string;
  guarded?: boolean;
}

export interface ModuleWorkerCapability {
  id: string;
  envKey: string;
  defaultIntervalMs: number;
  description: string;
}

export interface ModuleCapabilities {
  api?: ModuleApiCapability;
  workers?: readonly ModuleWorkerCapability[];
  documentModules?: readonly string[];
  hooks?: readonly string[];
}

export interface ModuleManifest {
  id: string;
  version: number;
  kind: ModuleKind;
  mutability: ModuleMutability;
  description: string;
  enabledByDefault: boolean;
  scopeSupport: ModuleScopeSupport;
  capabilities: ModuleCapabilities;
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

export interface ModuleStatePreviewInput {
  moduleId: string;
  scopeType: ModuleScopeType;
  scopeId?: string;
  state: ModuleState;
  reason: string;
  retryAfterSec?: number;
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

export interface ModuleStatePreviewDiff {
  moduleId: string;
  before: EffectiveModuleState;
  after: EffectiveModuleState;
}

export interface ModuleStatePreview {
  target: {
    moduleId: string;
    scopeType: ModuleScopeType;
    scopeId: string;
    state: ModuleState;
    reason: string;
    retryAfterSec: number;
  };
  impacted: ModuleStatePreviewDiff[];
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
  getEffectiveModuleState: (input: {
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
  previewModuleStateUpdate: (
    input: ModuleStatePreviewInput,
  ) => Promise<ModuleStatePreview>;
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
