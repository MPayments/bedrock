import type { Database } from "@bedrock/foundation/db-types";
import type { Logger } from "@bedrock/foundation/kernel";

export const COMPONENT_SCOPE_GLOBAL_ID = "__global__";
export const DEFAULT_RETRY_AFTER_SEC = 300;
export const MIN_RETRY_AFTER_SEC = 30;
export const MAX_RETRY_AFTER_SEC = 3_600;

export type ComponentState = "enabled" | "disabled";
export type ComponentScopeType = "global" | "book";
export type ComponentKind = "kernel" | "domain" | "integration" | "control";
export type ComponentMutability = "immutable" | "mutable";
export type ComponentApiVersion = "v1";

export interface ComponentDependency {
  componentId: string;
  reason: string;
}

export interface ComponentScopeSupport {
  global: true;
  book: boolean;
}

export interface ComponentApiCapability {
  version: ComponentApiVersion;
  routePath: string;
  guarded?: boolean;
}

export interface ComponentCapabilities {
  api?: ComponentApiCapability;
  workers?: readonly string[];
  documentModules?: readonly string[];
  hooks?: readonly string[];
}

export interface ComponentManifest {
  id: string;
  version: number;
  kind: ComponentKind;
  mutability: ComponentMutability;
  description: string;
  enabledByDefault: boolean;
  scopeSupport: ComponentScopeSupport;
  capabilities: ComponentCapabilities;
  dependencies: ComponentDependency[];
}

export interface ComponentRuntimeServiceDeps {
  db: Database;
  logger?: Logger;
  manifests: ComponentManifest[];
  cacheTtlMs?: number;
  epochPollIntervalMs?: number;
  pgListenChannel?: string;
}

export interface ComponentStateUpdateInput {
  componentId: string;
  scopeType: ComponentScopeType;
  scopeId?: string;
  state: ComponentState;
  reason: string;
  retryAfterSec?: number;
  expectedVersion: number;
  changedBy: string;
  requestId?: string | null;
}

export interface ComponentStatePreviewInput {
  componentId: string;
  scopeType: ComponentScopeType;
  scopeId?: string;
  state: ComponentState;
  reason: string;
  retryAfterSec?: number;
}

export interface ComponentStateListInput {
  componentId?: string;
  scopeType?: ComponentScopeType;
  scopeId?: string;
  limit?: number;
  offset?: number;
}

export interface ComponentRuntimeInfo {
  stateEpoch: bigint;
  manifestChecksum: string;
  manifestSeenVersion: number;
  updatedAt: Date;
  checksumMatches: boolean;
}

export interface EffectiveStateScope {
  scopeType: ComponentScopeType;
  scopeId: string;
}

export interface EffectiveComponentState {
  componentId: string;
  state: ComponentState;
  source: "default" | "global" | "book" | "dependency";
  reason: string | null;
  retryAfterSec: number;
  scope: EffectiveStateScope;
  dependencyChain: string[];
  manifestVersion: number;
}

export interface ListComponentsInput {
  bookId?: string;
}

export interface ListComponentEventsInput {
  componentId?: string;
  scopeType?: ComponentScopeType;
  scopeId?: string;
  limit?: number;
  offset?: number;
}

export interface ComponentStateEventRecord {
  id: string;
  componentId: string;
  scopeType: ComponentScopeType;
  scopeId: string;
  previousState: ComponentState | null;
  newState: ComponentState;
  reason: string;
  retryAfterSec: number;
  changedBy: string;
  changedAt: Date;
  requestId: string | null;
  meta: Record<string, unknown> | null;
}

export interface ComponentStateRecord {
  id: string;
  componentId: string;
  scopeType: ComponentScopeType;
  scopeId: string;
  state: ComponentState;
  reason: string;
  retryAfterSec: number;
  version: number;
  changedBy: string;
  changedAt: Date;
}

export interface ComponentStatePreviewDiff {
  componentId: string;
  before: EffectiveComponentState;
  after: EffectiveComponentState;
}

export interface ComponentStatePreview {
  target: {
    componentId: string;
    scopeType: ComponentScopeType;
    scopeId: string;
    state: ComponentState;
    reason: string;
    retryAfterSec: number;
  };
  impacted: ComponentStatePreviewDiff[];
}

export interface ComponentCatalogEntry {
  manifest: ComponentManifest;
  effective: EffectiveComponentState;
  globalState: ComponentStateRecord | null;
  bookState: ComponentStateRecord | null;
}

export interface ComponentRuntimeService {
  startBackgroundSync: () => Promise<void>;
  stopBackgroundSync: () => Promise<void>;
  getRuntimeInfo: () => Promise<ComponentRuntimeInfo>;
  listComponents: (input?: ListComponentsInput) => Promise<ComponentCatalogEntry[]>;
  getEffectiveComponentState: (input: {
    componentId: string;
    bookId?: string;
  }) => Promise<EffectiveComponentState>;
  isComponentEnabled: (input: {
    componentId: string;
    bookId?: string;
  }) => Promise<boolean>;
  assertComponentEnabled: (input: {
    componentId: string;
    bookId?: string;
  }) => Promise<void>;
  updateComponentState: (
    input: ComponentStateUpdateInput,
  ) => Promise<ComponentStateRecord>;
  previewComponentStateUpdate: (
    input: ComponentStatePreviewInput,
  ) => Promise<ComponentStatePreview>;
  listComponentEvents: (
    input?: ListComponentEventsInput,
  ) => Promise<ComponentStateEventRecord[]>;
  listComponentStates: (
    input?: ComponentStateListInput,
  ) => Promise<ComponentStateRecord[]>;
  validateGraph: () => void;
  manifests: ComponentManifest[];
  manifestChecksum: string;
}
