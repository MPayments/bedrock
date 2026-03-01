import { and, desc, eq, or, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { noopLogger, sha256Hex, stableStringify } from "@bedrock/kernel";

import {
  ImmutableModuleError,
  MixedDeployError,
  ModuleDependencyViolationError,
  ModuleDisabledError,
  ModuleManifestValidationError,
  ModuleStateVersionConflictError,
  UnknownModuleError,
} from "./errors";
import {
  DEFAULT_RETRY_AFTER_SEC,
  MAX_RETRY_AFTER_SEC,
  MIN_RETRY_AFTER_SEC,
  MODULE_SCOPE_GLOBAL_ID,
  type EffectiveModuleState,
  type ListModuleEventsInput,
  type ListModulesInput,
  type ModuleCatalogEntry,
  type ModuleManifest,
  type ModuleRuntimeInfo,
  type ModuleRuntimeService,
  type ModuleRuntimeServiceDeps,
  type ModuleStateListInput,
  type ModuleScopeType,
  type ModuleState,
  type ModuleStateEventRecord,
  type ModuleStateRecord,
  type ModuleStateUpdateInput,
} from "./types";

const ADVISORY_LOCK_KEY = 7_020_261;
const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_EPOCH_POLL_INTERVAL_MS = 5_000;
const DEFAULT_LISTEN_CHANNEL = "module_state_changed";

interface ScopeStateContext {
  global: Map<string, ModuleStateRecord>;
  book: Map<string, ModuleStateRecord>;
}

interface EffectiveCacheEntry {
  value: EffectiveModuleState;
  epoch: bigint;
  expiresAt: number;
}

interface ScopeCacheEntry {
  value: ScopeStateContext;
  epoch: bigint;
  expiresAt: number;
}

type DbLike = Database | Transaction;

interface ListenClient {
  query: (text: string) => Promise<unknown>;
  on: (
    event: "notification",
    listener: (message: { channel: string; payload?: string | null }) => void,
  ) => void;
  removeAllListeners?: (event: "notification") => void;
  release: () => void;
}

function clampRetryAfterSec(value: number | null | undefined): number {
  const candidate = Math.trunc(value ?? DEFAULT_RETRY_AFTER_SEC);
  return Math.max(
    MIN_RETRY_AFTER_SEC,
    Math.min(MAX_RETRY_AFTER_SEC, candidate),
  );
}

function normalizeScope(scopeType: ModuleScopeType, scopeId?: string) {
  if (scopeType === "global") {
    return { scopeType, scopeId: MODULE_SCOPE_GLOBAL_ID };
  }
  if (!scopeId || scopeId.trim().length === 0) {
    throw new Error("scopeId is required for book scope");
  }
  return { scopeType, scopeId: scopeId.trim() };
}

function normalizeManifestsForChecksum(manifests: ModuleManifest[]) {
  return [...manifests]
    .map((manifest) => ({
      ...manifest,
      dependencies: [...manifest.dependencies].sort((a, b) =>
        a.moduleId.localeCompare(b.moduleId),
      ),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function validateManifests(manifests: ModuleManifest[]) {
  const issues: string[] = [];
  const ids = new Set<string>();

  for (const manifest of manifests) {
    if (ids.has(manifest.id)) {
      issues.push(`duplicate module id ${manifest.id}`);
      continue;
    }
    ids.add(manifest.id);
  }

  for (const manifest of manifests) {
    for (const dependency of manifest.dependencies) {
      if (!ids.has(dependency.moduleId)) {
        issues.push(
          `module ${manifest.id} depends on missing module ${dependency.moduleId}`,
        );
      }
    }
  }

  const graph = new Map<string, string[]>();
  for (const manifest of manifests) {
    graph.set(
      manifest.id,
      manifest.dependencies.map((dependency) => dependency.moduleId),
    );
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(moduleId: string, stack: string[]) {
    if (visiting.has(moduleId)) {
      const cycleStart = stack.indexOf(moduleId);
      const cycle = [...stack.slice(cycleStart), moduleId];
      issues.push(`dependency cycle ${cycle.join(" -> ")}`);
      return;
    }
    if (visited.has(moduleId)) {
      return;
    }

    visiting.add(moduleId);
    stack.push(moduleId);

    for (const dependency of graph.get(moduleId) ?? []) {
      dfs(dependency, stack);
    }

    stack.pop();
    visiting.delete(moduleId);
    visited.add(moduleId);
  }

  for (const moduleId of graph.keys()) {
    dfs(moduleId, []);
  }

  if (issues.length > 0) {
    throw new ModuleManifestValidationError(issues);
  }
}

function stateKey(
  moduleId: string,
  scopeType: ModuleScopeType,
  scopeId: string,
) {
  return `${moduleId}|${scopeType}|${scopeId}`;
}

export function createModuleRuntimeService(
  deps: ModuleRuntimeServiceDeps,
): ModuleRuntimeService {
  const log = deps.logger?.child({ svc: "module-runtime" }) ?? noopLogger;
  const manifests = [...deps.manifests];

  validateManifests(manifests);

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
  let listenClient: ListenClient | null = null;
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
  ): Promise<ModuleRuntimeInfo> {
    const [existing] = await conn
      .select()
      .from(schema.platformModuleRuntimeMeta)
      .where(eq(schema.platformModuleRuntimeMeta.id, 1))
      .limit(1);

    let row = existing;

    if (!row) {
      const [created] = await conn
        .insert(schema.platformModuleRuntimeMeta)
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
        .update(schema.platformModuleRuntimeMeta)
        .set({
          manifestSeenVersion,
          updatedAt: new Date(),
        })
        .where(eq(schema.platformModuleRuntimeMeta.id, 1))
        .returning();
      row = updated;
    }

    const info: ModuleRuntimeInfo = {
      stateEpoch: row!.stateEpoch,
      manifestChecksum: row!.manifestChecksum,
      manifestSeenVersion: row!.manifestSeenVersion,
      updatedAt: row!.updatedAt,
      checksumMatches: row!.manifestChecksum === manifestChecksum,
      mixedDeploy: row!.manifestChecksum !== manifestChecksum,
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
      eq(schema.platformModuleStates.scopeType, "global"),
      eq(schema.platformModuleStates.scopeId, MODULE_SCOPE_GLOBAL_ID),
    );

    const whereClause = bookId
      ? or(
          globalFilter,
          and(
            eq(schema.platformModuleStates.scopeType, "book"),
            eq(schema.platformModuleStates.scopeId, bookId),
          ),
        )
      : globalFilter;

    const rows = await deps.db
      .select()
      .from(schema.platformModuleStates)
      .where(whereClause)
      .orderBy(schema.platformModuleStates.changedAt);

    const context: ScopeStateContext = {
      global: new Map(),
      book: new Map(),
    };

    for (const row of rows) {
      const record: ModuleStateRecord = {
        id: row.id,
        moduleId: row.moduleId,
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
        context.global.set(row.moduleId, record);
      } else {
        context.book.set(row.moduleId, record);
      }
    }

    scopeCache.set(scopeKeyValue, {
      value: context,
      epoch: currentEpoch,
      expiresAt: now + cacheTtlMs,
    });

    return context;
  }

  function getRequestedState(
    moduleId: string,
    context: ScopeStateContext,
  ): {
    state: ModuleState;
    source: "default" | "global" | "book";
    reason: string;
    retryAfterSec: number;
  } {
    const bookOverride = context.book.get(moduleId);
    if (bookOverride) {
      return {
        state: bookOverride.state,
        source: "book",
        reason: bookOverride.reason,
        retryAfterSec: clampRetryAfterSec(bookOverride.retryAfterSec),
      };
    }

    const globalOverride = context.global.get(moduleId);
    if (globalOverride) {
      return {
        state: globalOverride.state,
        source: "global",
        reason: globalOverride.reason,
        retryAfterSec: clampRetryAfterSec(globalOverride.retryAfterSec),
      };
    }

    const manifest = manifestMap.get(moduleId);
    if (!manifest) {
      throw new UnknownModuleError(moduleId);
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
    moduleId: string;
    scopeType: ModuleScopeType;
    scopeId: string;
    context: ScopeStateContext;
    memo: Map<string, EffectiveModuleState>;
  }): EffectiveModuleState {
    const memoKey = `${input.moduleId}|${input.scopeType}|${input.scopeId}`;
    const fromMemo = input.memo.get(memoKey);
    if (fromMemo) {
      return fromMemo;
    }

    const manifest = manifestMap.get(input.moduleId);
    if (!manifest) {
      throw new UnknownModuleError(input.moduleId);
    }

    const requested = getRequestedState(input.moduleId, input.context);
    const base: EffectiveModuleState = {
      moduleId: input.moduleId,
      state: requested.state,
      source: requested.source,
      reason: requested.reason,
      retryAfterSec: requested.retryAfterSec,
      scope: {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
      },
      dependencyChain: [input.moduleId],
      manifestVersion: manifest.version,
    };

    if (base.state === "disabled") {
      input.memo.set(memoKey, base);
      return base;
    }

    for (const dependency of manifest.dependencies) {
      const dependencyState = resolveEffectiveState({
        ...input,
        moduleId: dependency.moduleId,
      });

      if (dependencyState.state === "disabled") {
        const disabled: EffectiveModuleState = {
          ...base,
          state: "disabled",
          source: "dependency",
          reason: `dependency ${dependency.moduleId} is disabled`,
          retryAfterSec: Math.max(
            base.retryAfterSec,
            dependencyState.retryAfterSec,
          ),
          dependencyChain: [input.moduleId, ...dependencyState.dependencyChain],
        };
        input.memo.set(memoKey, disabled);
        return disabled;
      }
    }

    input.memo.set(memoKey, base);
    return base;
  }

  async function getEffectiveState(input: {
    moduleId: string;
    bookId?: string;
  }): Promise<EffectiveModuleState> {
    if (!manifestMap.has(input.moduleId)) {
      throw new UnknownModuleError(input.moduleId);
    }

    await refreshRuntimeInfo();

    const normalizedScope = input.bookId
      ? normalizeScope("book", input.bookId)
      : normalizeScope("global");

    const key = `${input.moduleId}|${normalizedScope.scopeType}|${normalizedScope.scopeId}`;
    const now = Date.now();
    const cached = effectiveCache.get(key);

    if (cached && cached.epoch === currentEpoch && cached.expiresAt > now) {
      return cached.value;
    }

    const context = await loadScopeStateContext(input.bookId);
    const resolved = resolveEffectiveState({
      moduleId: input.moduleId,
      scopeType: normalizedScope.scopeType,
      scopeId: normalizedScope.scopeId,
      context,
      memo: new Map(),
    });

    effectiveCache.set(key, {
      value: resolved,
      epoch: currentEpoch,
      expiresAt: now + cacheTtlMs,
    });

    return resolved;
  }

  async function isModuleEnabled(input: {
    moduleId: string;
    bookId?: string;
  }): Promise<boolean> {
    const effective = await getEffectiveState(input);
    return effective.state === "enabled";
  }

  async function assertModuleEnabled(input: {
    moduleId: string;
    bookId?: string;
  }): Promise<void> {
    const effective = await getEffectiveState(input);
    if (effective.state === "disabled") {
      throw new ModuleDisabledError(
        input.moduleId,
        effective.scope,
        effective.state,
        effective.dependencyChain,
        effective.retryAfterSec,
        effective.reason ?? "module disabled",
      );
    }
  }

  async function listModules(
    input: ListModulesInput = {},
  ): Promise<ModuleCatalogEntry[]> {
    await refreshRuntimeInfo();

    const context = await loadScopeStateContext(input.bookId);
    const scope = input.bookId
      ? normalizeScope("book", input.bookId)
      : normalizeScope("global");

    const memo = new Map<string, EffectiveModuleState>();

    return manifests
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((manifest) => {
        const effective = resolveEffectiveState({
          moduleId: manifest.id,
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
        } satisfies ModuleCatalogEntry;
      });
  }

  async function listModuleStates(input: ModuleStateListInput = {}) {
    const limit = Math.max(1, Math.min(500, input.limit ?? 100));
    const offset = Math.max(0, input.offset ?? 0);

    const predicates = [] as any[];

    if (input.moduleId) {
      predicates.push(eq(schema.platformModuleStates.moduleId, input.moduleId));
    }

    if (input.scopeType) {
      predicates.push(
        eq(schema.platformModuleStates.scopeType, input.scopeType),
      );
    }

    if (input.scopeId) {
      predicates.push(eq(schema.platformModuleStates.scopeId, input.scopeId));
    }

    const rows = await deps.db
      .select()
      .from(schema.platformModuleStates)
      .where(predicates.length > 0 ? and(...predicates) : undefined)
      .orderBy(desc(schema.platformModuleStates.changedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      moduleId: row.moduleId,
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      state: row.state,
      reason: row.reason,
      retryAfterSec: row.retryAfterSec,
      version: row.version,
      changedBy: row.changedBy,
      changedAt: row.changedAt,
    })) satisfies ModuleStateRecord[];
  }

  async function listModuleEvents(
    input: ListModuleEventsInput = {},
  ): Promise<ModuleStateEventRecord[]> {
    const limit = Math.max(1, Math.min(500, input.limit ?? 100));
    const offset = Math.max(0, input.offset ?? 0);

    const predicates = [] as any[];

    if (input.moduleId) {
      predicates.push(eq(schema.platformModuleEvents.moduleId, input.moduleId));
    }

    if (input.scopeType) {
      predicates.push(
        eq(schema.platformModuleEvents.scopeType, input.scopeType),
      );
    }

    if (input.scopeId) {
      predicates.push(eq(schema.platformModuleEvents.scopeId, input.scopeId));
    }

    const rows = await deps.db
      .select()
      .from(schema.platformModuleEvents)
      .where(predicates.length > 0 ? and(...predicates) : undefined)
      .orderBy(desc(schema.platformModuleEvents.changedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      moduleId: row.moduleId,
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
        moduleId: string;
        scopeType: ModuleScopeType;
        scopeId: string;
        state: ModuleState;
      }
    >;
  }) {
    const bookScopes = new Set<string>();

    for (const state of input.states.values()) {
      if (state.scopeType === "book") {
        bookScopes.add(state.scopeId);
      }
    }

    const scopes: { scopeType: ModuleScopeType; scopeId: string }[] = [
      { scopeType: "global", scopeId: MODULE_SCOPE_GLOBAL_ID },
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
            stateKey(manifest.id, "global", MODULE_SCOPE_GLOBAL_ID),
          );
        const ownState =
          own?.state ?? (manifest.enabledByDefault ? "enabled" : "disabled");

        if (ownState === "disabled") {
          continue;
        }

        for (const dependency of manifest.dependencies) {
          const depStateRecord =
            input.states.get(
              stateKey(dependency.moduleId, "book", scope.scopeId),
            ) ??
            input.states.get(
              stateKey(dependency.moduleId, "global", MODULE_SCOPE_GLOBAL_ID),
            );

          const depManifest = manifestMap.get(dependency.moduleId);
          const depState =
            depStateRecord?.state ??
            (depManifest?.enabledByDefault ? "enabled" : "disabled");

          if (depState === "disabled") {
            throw new ModuleDependencyViolationError(
              manifest.id,
              dependency.moduleId,
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

  async function updateModuleState(input: ModuleStateUpdateInput) {
    const manifest = manifestMap.get(input.moduleId);
    if (!manifest) {
      throw new UnknownModuleError(input.moduleId);
    }
    if (manifest.mutable === false) {
      throw new ImmutableModuleError(input.moduleId);
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
        .from(schema.platformModuleStates)
        .where(
          and(
            eq(schema.platformModuleStates.moduleId, input.moduleId),
            eq(
              schema.platformModuleStates.scopeType,
              normalizedScope.scopeType,
            ),
            eq(schema.platformModuleStates.scopeId, normalizedScope.scopeId),
          ),
        )
        .limit(1);

      const actualVersion = current?.version ?? 0;
      if (input.expectedVersion !== actualVersion) {
        throw new ModuleStateVersionConflictError(
          input.moduleId,
          normalizedScope.scopeType,
          normalizedScope.scopeId,
          input.expectedVersion,
          actualVersion,
        );
      }

      const allRows = await tx.select().from(schema.platformModuleStates);
      const stateMap = new Map<
        string,
        {
          moduleId: string;
          scopeType: ModuleScopeType;
          scopeId: string;
          state: ModuleState;
        }
      >();

      for (const row of allRows) {
        stateMap.set(stateKey(row.moduleId, row.scopeType, row.scopeId), {
          moduleId: row.moduleId,
          scopeType: row.scopeType,
          scopeId: row.scopeId,
          state: row.state,
        });
      }

      stateMap.set(
        stateKey(
          input.moduleId,
          normalizedScope.scopeType,
          normalizedScope.scopeId,
        ),
        {
          moduleId: input.moduleId,
          scopeType: normalizedScope.scopeType,
          scopeId: normalizedScope.scopeId,
          state: input.state,
        },
      );

      validateRequestedStates({ states: stateMap });

      const [saved] = await tx
        .insert(schema.platformModuleStates)
        .values({
          moduleId: input.moduleId,
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
            schema.platformModuleStates.moduleId,
            schema.platformModuleStates.scopeType,
            schema.platformModuleStates.scopeId,
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

      await tx.insert(schema.platformModuleEvents).values({
        moduleId: input.moduleId,
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
        .insert(schema.platformModuleRuntimeMeta)
        .values({
          id: 1,
          stateEpoch: 1n,
          manifestChecksum,
          manifestSeenVersion,
        })
        .onConflictDoUpdate({
          target: schema.platformModuleRuntimeMeta.id,
          set: {
            stateEpoch: sql`${schema.platformModuleRuntimeMeta.stateEpoch} + 1`,
            manifestSeenVersion: sql`GREATEST(${schema.platformModuleRuntimeMeta.manifestSeenVersion}, ${manifestSeenVersion})`,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!saved) {
        throw new Error("Failed to save platform module state");
      }

      if (!metaRow) {
        throw new Error("Failed to update module runtime metadata");
      }

      await tx.execute(
        sql`select pg_notify(${listenChannel}, ${metaRow.stateEpoch.toString()})`,
      );

      return {
        id: saved.id,
        moduleId: saved.moduleId,
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
      moduleId: updated.moduleId,
      scopeType: updated.scopeType,
      scopeId: updated.scopeId,
      state: updated.state,
      reason: updated.reason,
      retryAfterSec: updated.retryAfterSec,
      version: updated.version,
      changedBy: updated.changedBy,
      changedAt: updated.changedAt,
    } satisfies ModuleStateRecord;
  }

  async function getRuntimeInfo(): Promise<ModuleRuntimeInfo> {
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
        log.warn("Failed to poll module runtime epoch", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, epochPollIntervalMs);

    try {
      const pool = (
        deps.db as { $client?: { connect?: () => Promise<ListenClient> } }
      ).$client;
      if (!pool?.connect) {
        throw new Error("Database pool does not support LISTEN subscriptions");
      }

      listenClient = await pool.connect();

      listenClient.on(
        "notification",
        (message: { channel: string; payload?: string | null }) => {
          if (message.channel !== listenChannel) {
            return;
          }

          try {
            const nextEpoch = BigInt(message.payload ?? "0");
            if (nextEpoch > currentEpoch) {
              clearCaches(nextEpoch);
            }
          } catch {
            clearCaches();
          }
        },
      );

      await listenClient.query(`LISTEN ${listenChannel}`);
    } catch (error) {
      log.warn(
        "Module runtime LISTEN setup failed; poll fallback remains active",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );

      if (listenClient) {
        try {
          listenClient.release();
        } catch {
          // ignore close errors
        }
        listenClient = null;
      }
    }
  }

  async function stopBackgroundSync() {
    started = false;

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    if (listenClient) {
      try {
        await listenClient.query(`UNLISTEN ${listenChannel}`);
      } catch {
        // ignore unlisten errors
      }
      try {
        listenClient.removeAllListeners?.("notification");
        listenClient.release();
      } catch {
        // ignore close errors
      }
      listenClient = null;
    }
  }

  return {
    manifests,
    manifestChecksum,
    validateGraph: () => validateManifests(manifests),
    startBackgroundSync,
    stopBackgroundSync,
    getRuntimeInfo,
    listModules,
    getEffectiveState,
    isModuleEnabled,
    assertModuleEnabled,
    updateModuleState,
    listModuleEvents,
    listModuleStates,
  };
}
