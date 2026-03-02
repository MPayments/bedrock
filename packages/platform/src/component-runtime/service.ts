import { and, desc, eq, or, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema/component-runtime";
import type { Database, Transaction } from "@bedrock/db/types";
import {
  pgNotify,
  createPgSubscriber,
  type PgSubscriber,
} from "@bedrock/foundation/db/notify";
import { noopLogger, sha256Hex, stableStringify } from "@bedrock/foundation/kernel";

import {
  ImmutableComponentError,
  MixedDeployError,
  ComponentDependencyViolationError,
  ComponentDisabledError,
  ComponentManifestValidationError,
  ComponentStateVersionConflictError,
  UnknownComponentError,
} from "./errors";
import {
  DEFAULT_RETRY_AFTER_SEC,
  MAX_RETRY_AFTER_SEC,
  MIN_RETRY_AFTER_SEC,
  COMPONENT_SCOPE_GLOBAL_ID,
  type ComponentStatePreview,
  type ComponentStatePreviewInput,
  type EffectiveComponentState,
  type ListComponentEventsInput,
  type ListComponentsInput,
  type ComponentCatalogEntry,
  type ComponentManifest,
  type ComponentRuntimeInfo,
  type ComponentRuntimeService,
  type ComponentRuntimeServiceDeps,
  type ComponentStateListInput,
  type ComponentScopeType,
  type ComponentState,
  type ComponentStateEventRecord,
  type ComponentStateRecord,
  type ComponentStateUpdateInput,
} from "./types";

const ADVISORY_LOCK_KEY = 7_020_261;
const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_EPOCH_POLL_INTERVAL_MS = 5_000;
const DEFAULT_LISTEN_CHANNEL = "component_state_changed";
const MAX_EFFECTIVE_CACHE_SIZE = 1_000;
const MAX_SCOPE_CACHE_SIZE = 200;

interface ScopeStateContext {
  global: Map<string, ComponentStateRecord>;
  book: Map<string, ComponentStateRecord>;
}

interface EffectiveCacheEntry {
  value: EffectiveComponentState;
  epoch: bigint;
  expiresAt: number;
}

interface ScopeCacheEntry {
  value: ScopeStateContext;
  epoch: bigint;
  expiresAt: number;
}

type DbLike = Database | Transaction;

function clampRetryAfterSec(value: number | null | undefined): number {
  const candidate = Math.trunc(value ?? DEFAULT_RETRY_AFTER_SEC);
  return Math.max(
    MIN_RETRY_AFTER_SEC,
    Math.min(MAX_RETRY_AFTER_SEC, candidate),
  );
}

function normalizeScope(scopeType: ComponentScopeType, scopeId?: string) {
  if (scopeType === "global") {
    return { scopeType, scopeId: COMPONENT_SCOPE_GLOBAL_ID };
  }
  if (!scopeId || scopeId.trim().length === 0) {
    throw new Error("scopeId is required for book scope");
  }
  return { scopeType, scopeId: scopeId.trim() };
}

function normalizeManifestsForChecksum(manifests: ComponentManifest[]) {
  return [...manifests]
    .map((manifest) => ({
      ...manifest,
      capabilities: {
        ...manifest.capabilities,
        workers: manifest.capabilities.workers
          ? [...manifest.capabilities.workers].sort((left, right) =>
              left.id.localeCompare(right.id),
            )
          : undefined,
      },
      dependencies: [...manifest.dependencies].sort((a, b) =>
        a.componentId.localeCompare(b.componentId),
      ),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function validateComponentManifests(manifests: ComponentManifest[]) {
  const issues: string[] = [];
  const ids = new Set<string>();
  const globalWorkerIds = new Set<string>();
  const globalWorkerEnvKeys = new Set<string>();

  for (const manifest of manifests) {
    if (!manifest.id.trim()) {
      issues.push("component id must be non-empty");
    }
    if (ids.has(manifest.id)) {
      issues.push(`duplicate component id ${manifest.id}`);
      continue;
    }
    ids.add(manifest.id);

    if (manifest.version <= 0 || !Number.isInteger(manifest.version)) {
      issues.push(`component ${manifest.id} must have positive integer version`);
    }

    if (manifest.scopeSupport.global !== true) {
      issues.push(`component ${manifest.id} must support global scope`);
    }

    if (
      manifest.capabilities.api?.version &&
      !manifest.capabilities.api.routePath
    ) {
      issues.push(`component ${manifest.id} api capability must define routePath`);
    }

    if (manifest.capabilities.workers) {
      const seenWorkerIds = new Set<string>();
      const seenWorkerEnvKeys = new Set<string>();
      for (const worker of manifest.capabilities.workers) {
        if (!worker.id.trim()) {
          issues.push(`component ${manifest.id} has empty worker capability id`);
          continue;
        }
        if (!worker.envKey.trim()) {
          issues.push(
            `component ${manifest.id} has worker ${worker.id} with empty envKey`,
          );
          continue;
        }
        if (!Number.isInteger(worker.defaultIntervalMs) || worker.defaultIntervalMs <= 0) {
          issues.push(
            `component ${manifest.id} worker ${worker.id} must have positive integer defaultIntervalMs`,
          );
        }
        if (!worker.description.trim()) {
          issues.push(
            `component ${manifest.id} worker ${worker.id} must have non-empty description`,
          );
        }
        if (seenWorkerIds.has(worker.id)) {
          issues.push(
            `component ${manifest.id} has duplicate worker capability ${worker.id}`,
          );
          continue;
        }
        if (seenWorkerEnvKeys.has(worker.envKey)) {
          issues.push(
            `component ${manifest.id} has duplicate worker envKey ${worker.envKey}`,
          );
          continue;
        }
        seenWorkerIds.add(worker.id);
        seenWorkerEnvKeys.add(worker.envKey);

        if (globalWorkerIds.has(worker.id)) {
          issues.push(`duplicate worker capability id ${worker.id}`);
        } else {
          globalWorkerIds.add(worker.id);
        }

        if (globalWorkerEnvKeys.has(worker.envKey)) {
          issues.push(`duplicate worker envKey ${worker.envKey}`);
        } else {
          globalWorkerEnvKeys.add(worker.envKey);
        }
      }
    }
  }

  for (const manifest of manifests) {
    for (const dependency of manifest.dependencies) {
      if (!ids.has(dependency.componentId)) {
        issues.push(
          `component ${manifest.id} depends on missing component ${dependency.componentId}`,
        );
      }
    }
  }

  const graph = new Map<string, string[]>();
  for (const manifest of manifests) {
    graph.set(
      manifest.id,
      manifest.dependencies.map((dependency) => dependency.componentId),
    );
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(componentId: string, stack: string[]) {
    if (visiting.has(componentId)) {
      const cycleStart = stack.indexOf(componentId);
      const cycle = [...stack.slice(cycleStart), componentId];
      issues.push(`dependency cycle ${cycle.join(" -> ")}`);
      return;
    }
    if (visited.has(componentId)) {
      return;
    }

    visiting.add(componentId);
    stack.push(componentId);

    for (const dependency of graph.get(componentId) ?? []) {
      dfs(dependency, stack);
    }

    stack.pop();
    visiting.delete(componentId);
    visited.add(componentId);
  }

  for (const componentId of graph.keys()) {
    dfs(componentId, []);
  }

  if (issues.length > 0) {
    throw new ComponentManifestValidationError(issues);
  }
}

function orderManifestsTopologically(
  manifests: ComponentManifest[],
): ComponentManifest[] {
  const byId = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const manifest of manifests) {
    inDegree.set(manifest.id, manifest.dependencies.length);
    for (const dependency of manifest.dependencies) {
      const next = dependents.get(dependency.componentId) ?? [];
      next.push(manifest.id);
      dependents.set(dependency.componentId, next);
    }
  }

  const ready = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([componentId]) => componentId)
    .sort((a, b) => a.localeCompare(b));

  const ordered: string[] = [];

  while (ready.length > 0) {
    const nextId = ready.shift()!;
    ordered.push(nextId);

    for (const dependentId of dependents.get(nextId) ?? []) {
      const remaining = (inDegree.get(dependentId) ?? 0) - 1;
      inDegree.set(dependentId, remaining);
      if (remaining === 0) {
        ready.push(dependentId);
      }
    }

    ready.sort((a, b) => a.localeCompare(b));
  }

  return ordered.map((id) => byId.get(id)!);
}

function stateKey(
  componentId: string,
  scopeType: ComponentScopeType,
  scopeId: string,
) {
  return `${componentId}|${scopeType}|${scopeId}`;
}

export function createComponentRuntimeService(
  deps: ComponentRuntimeServiceDeps,
): ComponentRuntimeService {
  const log = deps.logger?.child({ svc: "component-runtime" }) ?? noopLogger;
  const manifests = [...deps.manifests];

  validateComponentManifests(manifests);
  const orderedManifests = orderManifestsTopologically(manifests);

  const manifestMap = new Map(
    manifests.map((manifest) => [manifest.id, manifest]),
  );
  const manifestSeenVersion = manifests.reduce(
    (maxVersion, manifest) => Math.max(maxVersion, manifest.version),
    0,
  );
  const manifestChecksum = sha256Hex(
    stableStringify(normalizeManifestsForChecksum(manifests)),
  );

  const cacheTtlMs = deps.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const epochPollIntervalMs =
    deps.epochPollIntervalMs ?? DEFAULT_EPOCH_POLL_INTERVAL_MS;
  const listenChannel = deps.pgListenChannel ?? DEFAULT_LISTEN_CHANNEL;

  const effectiveCache = new Map<string, EffectiveCacheEntry>();
  const scopeCache = new Map<string, ScopeCacheEntry>();

  let currentEpoch = 0n;
  let started = false;
  let subscriber: PgSubscriber | null = null;
  let pollTimer: NodeJS.Timeout | null = null;

  function clearCaches(nextEpoch?: bigint) {
    if (typeof nextEpoch === "bigint") {
      currentEpoch = nextEpoch;
    }
    effectiveCache.clear();
    scopeCache.clear();
  }

  async function ensureRuntimeMeta(
    conn: DbLike = deps.db,
  ): Promise<ComponentRuntimeInfo> {
    const [existing] = await conn
      .select()
      .from(schema.platformComponentRuntimeMeta)
      .where(eq(schema.platformComponentRuntimeMeta.id, 1))
      .limit(1);

    let row = existing;

    if (!row) {
      const [created] = await conn
        .insert(schema.platformComponentRuntimeMeta)
        .values({
          id: 1,
          stateEpoch: 1n,
          manifestChecksum,
          manifestSeenVersion,
        })
        .returning();
      row = created;
    } else if (row.manifestSeenVersion < manifestSeenVersion) {
      const [updated] = await conn
        .update(schema.platformComponentRuntimeMeta)
        .set({
          manifestSeenVersion,
          updatedAt: new Date(),
        })
        .where(eq(schema.platformComponentRuntimeMeta.id, 1))
        .returning();
      row = updated;
    }

    const info: ComponentRuntimeInfo = {
      stateEpoch: row!.stateEpoch,
      manifestChecksum: row!.manifestChecksum,
      manifestSeenVersion: row!.manifestSeenVersion,
      updatedAt: row!.updatedAt,
      checksumMatches: row!.manifestChecksum === manifestChecksum,
    };

    currentEpoch = info.stateEpoch;
    return info;
  }

  async function refreshRuntimeInfo() {
    const info = await ensureRuntimeMeta();
    if (info.stateEpoch !== currentEpoch) {
      clearCaches(info.stateEpoch);
    }
    return info;
  }

  async function loadScopeStateContext(
    bookId?: string,
  ): Promise<ScopeStateContext> {
    const scopeKeyValue = bookId ? `book:${bookId}` : "global";
    const now = Date.now();

    const cached = scopeCache.get(scopeKeyValue);
    if (cached && cached.epoch === currentEpoch && cached.expiresAt > now) {
      return cached.value;
    }

    const globalFilter = and(
      eq(schema.platformComponentStates.scopeType, "global"),
      eq(schema.platformComponentStates.scopeId, COMPONENT_SCOPE_GLOBAL_ID),
    );

    const whereClause = bookId
      ? or(
          globalFilter,
          and(
            eq(schema.platformComponentStates.scopeType, "book"),
            eq(schema.platformComponentStates.scopeId, bookId),
          ),
        )
      : globalFilter;

    const rows = await deps.db
      .select()
      .from(schema.platformComponentStates)
      .where(whereClause)
      .orderBy(schema.platformComponentStates.changedAt);

    const context: ScopeStateContext = {
      global: new Map(),
      book: new Map(),
    };

    for (const row of rows) {
      const record: ComponentStateRecord = {
        id: row.id,
        componentId: row.componentId,
        scopeType: row.scopeType,
        scopeId: row.scopeId,
        state: row.state,
        reason: row.reason,
        retryAfterSec: row.retryAfterSec,
        version: row.version,
        changedBy: row.changedBy,
        changedAt: row.changedAt,
      };

      if (row.scopeType === "global") {
        context.global.set(row.componentId, record);
      } else {
        context.book.set(row.componentId, record);
      }
    }

    if (scopeCache.size >= MAX_SCOPE_CACHE_SIZE) {
      scopeCache.clear();
    }
    scopeCache.set(scopeKeyValue, {
      value: context,
      epoch: currentEpoch,
      expiresAt: now + cacheTtlMs,
    });

    return context;
  }

  function getRequestedState(
    componentId: string,
    context: ScopeStateContext,
  ): {
    state: ComponentState;
    source: "default" | "global" | "book";
    reason: string;
    retryAfterSec: number;
  } {
    const bookOverride = context.book.get(componentId);
    if (bookOverride) {
      return {
        state: bookOverride.state,
        source: "book",
        reason: bookOverride.reason,
        retryAfterSec: clampRetryAfterSec(bookOverride.retryAfterSec),
      };
    }

    const globalOverride = context.global.get(componentId);
    if (globalOverride) {
      return {
        state: globalOverride.state,
        source: "global",
        reason: globalOverride.reason,
        retryAfterSec: clampRetryAfterSec(globalOverride.retryAfterSec),
      };
    }

    const manifest = manifestMap.get(componentId);
    if (!manifest) {
      throw new UnknownComponentError(componentId);
    }

    return {
      state: manifest.enabledByDefault ? "enabled" : "disabled",
      source: "default",
      reason: manifest.enabledByDefault
        ? "enabled by default"
        : "disabled by default",
      retryAfterSec: DEFAULT_RETRY_AFTER_SEC,
    };
  }

  function resolveEffectiveState(input: {
    componentId: string;
    scopeType: ComponentScopeType;
    scopeId: string;
    context: ScopeStateContext;
    memo: Map<string, EffectiveComponentState>;
  }): EffectiveComponentState {
    const memoKey = `${input.componentId}|${input.scopeType}|${input.scopeId}`;
    const fromMemo = input.memo.get(memoKey);
    if (fromMemo) {
      return fromMemo;
    }

    const manifest = manifestMap.get(input.componentId);
    if (!manifest) {
      throw new UnknownComponentError(input.componentId);
    }

    const requested = getRequestedState(input.componentId, input.context);
    const base: EffectiveComponentState = {
      componentId: input.componentId,
      state: requested.state,
      source: requested.source,
      reason: requested.reason,
      retryAfterSec: requested.retryAfterSec,
      scope: {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
      },
      dependencyChain: [input.componentId],
      manifestVersion: manifest.version,
    };

    if (base.state === "disabled") {
      input.memo.set(memoKey, base);
      return base;
    }

    for (const dependency of manifest.dependencies) {
      const dependencyState = resolveEffectiveState({
        ...input,
        componentId: dependency.componentId,
      });

      if (dependencyState.state === "disabled") {
        const disabled: EffectiveComponentState = {
          ...base,
          state: "disabled",
          source: "dependency",
          reason: `dependency ${dependency.componentId} is disabled`,
          retryAfterSec: Math.max(
            base.retryAfterSec,
            dependencyState.retryAfterSec,
          ),
          dependencyChain: [input.componentId, ...dependencyState.dependencyChain],
        };
        input.memo.set(memoKey, disabled);
        return disabled;
      }
    }

    input.memo.set(memoKey, base);
    return base;
  }

  async function getEffectiveComponentState(input: {
    componentId: string;
    bookId?: string;
  }): Promise<EffectiveComponentState> {
    if (!manifestMap.has(input.componentId)) {
      throw new UnknownComponentError(input.componentId);
    }

    await refreshRuntimeInfo();

    const normalizedScope = input.bookId
      ? normalizeScope("book", input.bookId)
      : normalizeScope("global");

    const key = `${input.componentId}|${normalizedScope.scopeType}|${normalizedScope.scopeId}`;
    const now = Date.now();
    const cached = effectiveCache.get(key);

    if (cached && cached.epoch === currentEpoch && cached.expiresAt > now) {
      return cached.value;
    }

    const context = await loadScopeStateContext(input.bookId);
    const resolved = resolveEffectiveState({
      componentId: input.componentId,
      scopeType: normalizedScope.scopeType,
      scopeId: normalizedScope.scopeId,
      context,
      memo: new Map(),
    });

    if (effectiveCache.size >= MAX_EFFECTIVE_CACHE_SIZE) {
      effectiveCache.clear();
    }
    effectiveCache.set(key, {
      value: resolved,
      epoch: currentEpoch,
      expiresAt: now + cacheTtlMs,
    });

    return resolved;
  }

  async function isComponentEnabled(input: {
    componentId: string;
    bookId?: string;
  }): Promise<boolean> {
    const effective = await getEffectiveComponentState(input);
    return effective.state === "enabled";
  }

  async function assertComponentEnabled(input: {
    componentId: string;
    bookId?: string;
  }): Promise<void> {
    const effective = await getEffectiveComponentState(input);
    if (effective.state === "disabled") {
      throw new ComponentDisabledError(
        input.componentId,
        effective.scope,
        effective.state,
        effective.dependencyChain,
        effective.retryAfterSec,
        effective.reason ?? "component disabled",
      );
    }
  }

  async function listComponents(
    input: ListComponentsInput = {},
  ): Promise<ComponentCatalogEntry[]> {
    await refreshRuntimeInfo();

    const context = await loadScopeStateContext(input.bookId);
    const scope = input.bookId
      ? normalizeScope("book", input.bookId)
      : normalizeScope("global");

    const memo = new Map<string, EffectiveComponentState>();

    return orderedManifests
      .map((manifest) => {
        const effective = resolveEffectiveState({
          componentId: manifest.id,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          context,
          memo,
        });

        return {
          manifest,
          effective,
          globalState: context.global.get(manifest.id) ?? null,
          bookState: context.book.get(manifest.id) ?? null,
        } satisfies ComponentCatalogEntry;
      });
  }

  function cloneScopeStateContext(context: ScopeStateContext): ScopeStateContext {
    return {
      global: new Map(context.global),
      book: new Map(context.book),
    };
  }

  function resolveScopeEffectiveStates(input: {
    scopeType: ComponentScopeType;
    scopeId: string;
    context: ScopeStateContext;
  }) {
    const memo = new Map<string, EffectiveComponentState>();
    const states = new Map<string, EffectiveComponentState>();
    for (const manifest of orderedManifests) {
      states.set(
        manifest.id,
        resolveEffectiveState({
          componentId: manifest.id,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          context: input.context,
          memo,
        }),
      );
    }
    return states;
  }

  function sameEffectiveState(
    left: EffectiveComponentState,
    right: EffectiveComponentState,
  ) {
    if (left.state !== right.state) {
      return false;
    }
    if (left.source !== right.source) {
      return false;
    }
    if ((left.reason ?? null) !== (right.reason ?? null)) {
      return false;
    }
    if (left.retryAfterSec !== right.retryAfterSec) {
      return false;
    }
    if (left.dependencyChain.length !== right.dependencyChain.length) {
      return false;
    }
    for (let index = 0; index < left.dependencyChain.length; index += 1) {
      if (left.dependencyChain[index] !== right.dependencyChain[index]) {
        return false;
      }
    }
    return true;
  }

  async function listComponentStates(input: ComponentStateListInput = {}) {
    const limit = Math.max(1, Math.min(500, input.limit ?? 100));
    const offset = Math.max(0, input.offset ?? 0);

    const predicates = [] as any[];

    if (input.componentId) {
      predicates.push(eq(schema.platformComponentStates.componentId, input.componentId));
    }

    if (input.scopeType) {
      predicates.push(
        eq(schema.platformComponentStates.scopeType, input.scopeType),
      );
    }

    if (input.scopeId) {
      predicates.push(eq(schema.platformComponentStates.scopeId, input.scopeId));
    }

    const rows = await deps.db
      .select()
      .from(schema.platformComponentStates)
      .where(predicates.length > 0 ? and(...predicates) : undefined)
      .orderBy(desc(schema.platformComponentStates.changedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      componentId: row.componentId,
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      state: row.state,
      reason: row.reason,
      retryAfterSec: row.retryAfterSec,
      version: row.version,
      changedBy: row.changedBy,
      changedAt: row.changedAt,
    })) satisfies ComponentStateRecord[];
  }

  async function listComponentEvents(
    input: ListComponentEventsInput = {},
  ): Promise<ComponentStateEventRecord[]> {
    const limit = Math.max(1, Math.min(500, input.limit ?? 100));
    const offset = Math.max(0, input.offset ?? 0);

    const predicates = [] as any[];

    if (input.componentId) {
      predicates.push(eq(schema.platformComponentEvents.componentId, input.componentId));
    }

    if (input.scopeType) {
      predicates.push(
        eq(schema.platformComponentEvents.scopeType, input.scopeType),
      );
    }

    if (input.scopeId) {
      predicates.push(eq(schema.platformComponentEvents.scopeId, input.scopeId));
    }

    const rows = await deps.db
      .select()
      .from(schema.platformComponentEvents)
      .where(predicates.length > 0 ? and(...predicates) : undefined)
      .orderBy(desc(schema.platformComponentEvents.changedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      componentId: row.componentId,
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      previousState: row.previousState,
      newState: row.newState,
      reason: row.reason,
      retryAfterSec: row.retryAfterSec,
      changedBy: row.changedBy,
      changedAt: row.changedAt,
      requestId: row.requestId,
      meta: row.meta,
    }));
  }

  function validateRequestedStates(input: {
    states: Map<
      string,
      {
        componentId: string;
        scopeType: ComponentScopeType;
        scopeId: string;
        state: ComponentState;
      }
    >;
  }) {
    const bookScopes = new Set<string>();

    for (const state of input.states.values()) {
      if (state.scopeType === "book") {
        bookScopes.add(state.scopeId);
      }
    }

    const scopes: { scopeType: ComponentScopeType; scopeId: string }[] = [
      { scopeType: "global", scopeId: COMPONENT_SCOPE_GLOBAL_ID },
      ...[...bookScopes].map((scopeId) => ({
        scopeType: "book" as const,
        scopeId,
      })),
    ];

    for (const scope of scopes) {
      for (const manifest of manifests) {
        const own =
          input.states.get(stateKey(manifest.id, "book", scope.scopeId)) ??
          input.states.get(
            stateKey(manifest.id, "global", COMPONENT_SCOPE_GLOBAL_ID),
          );
        const ownState =
          own?.state ?? (manifest.enabledByDefault ? "enabled" : "disabled");

        if (ownState === "disabled") {
          continue;
        }

        for (const dependency of manifest.dependencies) {
          const depStateRecord =
            input.states.get(
              stateKey(dependency.componentId, "book", scope.scopeId),
            ) ??
            input.states.get(
              stateKey(dependency.componentId, "global", COMPONENT_SCOPE_GLOBAL_ID),
            );

          const depManifest = manifestMap.get(dependency.componentId);
          const depState =
            depStateRecord?.state ??
            (depManifest?.enabledByDefault ? "enabled" : "disabled");

          if (depState === "disabled") {
            throw new ComponentDependencyViolationError(
              manifest.id,
              dependency.componentId,
              {
                scopeType: scope.scopeType,
                scopeId: scope.scopeId,
              },
            );
          }
        }
      }
    }
  }

  async function updateComponentState(input: ComponentStateUpdateInput) {
    const manifest = manifestMap.get(input.componentId);
    if (!manifest) {
      throw new UnknownComponentError(input.componentId);
    }
    if (manifest.mutability === "immutable") {
      throw new ImmutableComponentError(input.componentId);
    }

    const normalizedScope = normalizeScope(input.scopeType, input.scopeId);
    const normalizedRetryAfter = clampRetryAfterSec(input.retryAfterSec);

    const updated = await deps.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);

      const runtimeInfo = await ensureRuntimeMeta(tx);
      if (!runtimeInfo.checksumMatches) {
        throw new MixedDeployError(
          runtimeInfo.manifestChecksum,
          manifestChecksum,
        );
      }

      const [current] = await tx
        .select()
        .from(schema.platformComponentStates)
        .where(
          and(
            eq(schema.platformComponentStates.componentId, input.componentId),
            eq(
              schema.platformComponentStates.scopeType,
              normalizedScope.scopeType,
            ),
            eq(schema.platformComponentStates.scopeId, normalizedScope.scopeId),
          ),
        )
        .limit(1);

      const actualVersion = current?.version ?? 0;
      if (input.expectedVersion !== actualVersion) {
        throw new ComponentStateVersionConflictError(
          input.componentId,
          normalizedScope.scopeType,
          normalizedScope.scopeId,
          input.expectedVersion,
          actualVersion,
        );
      }

      const allRows = await tx.select().from(schema.platformComponentStates);
      const stateMap = new Map<
        string,
        {
          componentId: string;
          scopeType: ComponentScopeType;
          scopeId: string;
          state: ComponentState;
        }
      >();

      for (const row of allRows) {
        stateMap.set(stateKey(row.componentId, row.scopeType, row.scopeId), {
          componentId: row.componentId,
          scopeType: row.scopeType,
          scopeId: row.scopeId,
          state: row.state,
        });
      }

      stateMap.set(
        stateKey(
          input.componentId,
          normalizedScope.scopeType,
          normalizedScope.scopeId,
        ),
        {
          componentId: input.componentId,
          scopeType: normalizedScope.scopeType,
          scopeId: normalizedScope.scopeId,
          state: input.state,
        },
      );

      validateRequestedStates({ states: stateMap });

      const [saved] = await tx
        .insert(schema.platformComponentStates)
        .values({
          componentId: input.componentId,
          scopeType: normalizedScope.scopeType,
          scopeId: normalizedScope.scopeId,
          state: input.state,
          reason: input.reason,
          retryAfterSec: normalizedRetryAfter,
          version: actualVersion + 1,
          changedBy: input.changedBy,
          changedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            schema.platformComponentStates.componentId,
            schema.platformComponentStates.scopeType,
            schema.platformComponentStates.scopeId,
          ],
          set: {
            state: input.state,
            reason: input.reason,
            retryAfterSec: normalizedRetryAfter,
            version: actualVersion + 1,
            changedBy: input.changedBy,
            changedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      await tx.insert(schema.platformComponentEvents).values({
        componentId: input.componentId,
        scopeType: normalizedScope.scopeType,
        scopeId: normalizedScope.scopeId,
        previousState: current?.state ?? null,
        newState: input.state,
        reason: input.reason,
        retryAfterSec: normalizedRetryAfter,
        changedBy: input.changedBy,
        changedAt: new Date(),
        requestId: input.requestId ?? null,
        meta: {
          previousVersion: current?.version ?? 0,
          newVersion: actualVersion + 1,
        },
      });

      const [metaRow] = await tx
        .insert(schema.platformComponentRuntimeMeta)
        .values({
          id: 1,
          stateEpoch: 1n,
          manifestChecksum,
          manifestSeenVersion,
        })
        .onConflictDoUpdate({
          target: schema.platformComponentRuntimeMeta.id,
          set: {
            stateEpoch: sql`${schema.platformComponentRuntimeMeta.stateEpoch} + 1`,
            manifestSeenVersion: sql`GREATEST(${schema.platformComponentRuntimeMeta.manifestSeenVersion}, ${manifestSeenVersion})`,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!saved) {
        throw new Error("Failed to save platform component state");
      }

      if (!metaRow) {
        throw new Error("Failed to update component runtime metadata");
      }

      await pgNotify(tx, listenChannel, metaRow.stateEpoch.toString());

      return {
        id: saved.id,
        componentId: saved.componentId,
        scopeType: saved.scopeType,
        scopeId: saved.scopeId,
        state: saved.state,
        reason: saved.reason,
        retryAfterSec: saved.retryAfterSec,
        version: saved.version,
        changedBy: saved.changedBy,
        changedAt: saved.changedAt,
        epoch: metaRow.stateEpoch,
      };
    });

    clearCaches(updated.epoch);

    return {
      id: updated.id,
      componentId: updated.componentId,
      scopeType: updated.scopeType,
      scopeId: updated.scopeId,
      state: updated.state,
      reason: updated.reason,
      retryAfterSec: updated.retryAfterSec,
      version: updated.version,
      changedBy: updated.changedBy,
      changedAt: updated.changedAt,
    } satisfies ComponentStateRecord;
  }

  async function previewComponentStateUpdate(
    input: ComponentStatePreviewInput,
  ): Promise<ComponentStatePreview> {
    const manifest = manifestMap.get(input.componentId);
    if (!manifest) {
      throw new UnknownComponentError(input.componentId);
    }
    if (manifest.mutability === "immutable") {
      throw new ImmutableComponentError(input.componentId);
    }

    await refreshRuntimeInfo();

    const normalizedScope = normalizeScope(input.scopeType, input.scopeId);
    const normalizedRetryAfter = clampRetryAfterSec(input.retryAfterSec);
    const scopedBookId =
      normalizedScope.scopeType === "book" ? normalizedScope.scopeId : undefined;

    const currentScope = await loadScopeStateContext(scopedBookId);
    const previewScope = cloneScopeStateContext(currentScope);
    const now = new Date();
    const previewRecord: ComponentStateRecord = {
      id: "__preview__",
      componentId: input.componentId,
      scopeType: normalizedScope.scopeType,
      scopeId: normalizedScope.scopeId,
      state: input.state,
      reason: input.reason,
      retryAfterSec: normalizedRetryAfter,
      version: 0,
      changedBy: "__preview__",
      changedAt: now,
    };

    if (normalizedScope.scopeType === "global") {
      previewScope.global.set(input.componentId, previewRecord);
    } else {
      previewScope.book.set(input.componentId, previewRecord);
    }

    const allRows = await deps.db.select().from(schema.platformComponentStates);
    const stateMap = new Map<
      string,
      {
        componentId: string;
        scopeType: ComponentScopeType;
        scopeId: string;
        state: ComponentState;
      }
    >();
    for (const row of allRows) {
      stateMap.set(stateKey(row.componentId, row.scopeType, row.scopeId), {
        componentId: row.componentId,
        scopeType: row.scopeType,
        scopeId: row.scopeId,
        state: row.state,
      });
    }
    stateMap.set(
      stateKey(
        input.componentId,
        normalizedScope.scopeType,
        normalizedScope.scopeId,
      ),
      {
        componentId: input.componentId,
        scopeType: normalizedScope.scopeType,
        scopeId: normalizedScope.scopeId,
        state: input.state,
      },
    );
    validateRequestedStates({ states: stateMap });

    const before = resolveScopeEffectiveStates({
      scopeType: normalizedScope.scopeType,
      scopeId: normalizedScope.scopeId,
      context: currentScope,
    });
    const after = resolveScopeEffectiveStates({
      scopeType: normalizedScope.scopeType,
      scopeId: normalizedScope.scopeId,
      context: previewScope,
    });

    const impacted = orderedManifests
      .map((candidate) => {
        const beforeState = before.get(candidate.id)!;
        const afterState = after.get(candidate.id)!;
        if (sameEffectiveState(beforeState, afterState)) {
          return null;
        }
        return {
          componentId: candidate.id,
          before: beforeState,
          after: afterState,
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      );

    return {
      target: {
        componentId: input.componentId,
        scopeType: normalizedScope.scopeType,
        scopeId: normalizedScope.scopeId,
        state: input.state,
        reason: input.reason,
        retryAfterSec: normalizedRetryAfter,
      },
      impacted,
    };
  }

  async function getRuntimeInfo(): Promise<ComponentRuntimeInfo> {
    return refreshRuntimeInfo();
  }

  async function startBackgroundSync() {
    if (started) {
      return;
    }
    started = true;

    await refreshRuntimeInfo();

    pollTimer = setInterval(() => {
      void refreshRuntimeInfo().catch((error) => {
        log.warn("Failed to poll component runtime epoch", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, epochPollIntervalMs);

    try {
      subscriber = await createPgSubscriber(deps.db);
      await subscriber.subscribe(listenChannel, (payload) => {
        try {
          const nextEpoch = BigInt(payload || "0");
          if (nextEpoch > currentEpoch) {
            clearCaches(nextEpoch);
          }
        } catch {
          clearCaches();
        }
      });
    } catch (error) {
      log.warn(
        "Component runtime LISTEN setup failed; poll fallback remains active",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      if (subscriber) {
        await subscriber.close();
      }
      subscriber = null;
    }
  }

  async function stopBackgroundSync() {
    started = false;

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    if (subscriber) {
      await subscriber.close();
      subscriber = null;
    }
  }

  return {
    manifests: orderedManifests,
    manifestChecksum,
    validateGraph: () => validateComponentManifests(manifests),
    startBackgroundSync,
    stopBackgroundSync,
    getRuntimeInfo,
    listComponents,
    getEffectiveComponentState,
    isComponentEnabled,
    assertComponentEnabled,
    updateComponentState,
    previewComponentStateUpdate,
    listComponentEvents,
    listComponentStates,
  };
}
