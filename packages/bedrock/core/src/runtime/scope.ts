import {
  bootError,
  dependencyResolutionError,
  scopeError,
} from "@bedrock/common";

import {
  createAppExecutionContext,
  resolveBuiltInExecutionToken,
  type ExecutionContext,
  isBuiltInExecutionTokenKey,
} from "../execution-context";
import { getTokenKey, type TokenMap } from "../kernel";
import { isExistingProvider, isFactoryProvider } from "../provider";
import { createChildLogger } from "./logger";
import { deriveDescriptorContext, wrapBootFailure } from "./support";
import type {
  CompiledApp,
  ControllerContextTools,
  ControllerRecord,
  ExecutionScope,
  ProviderDisposeRecord,
  ProviderRecord,
  ResolveTokenMap,
  ServiceBinding,
  ServiceRecord,
  StartedApp,
} from "./types";

export function createExecutionScope(
  compiled: CompiledApp,
  started: StartedApp,
  executionContext: ExecutionContext = createAppExecutionContext(),
): ExecutionScope {
  return {
    compiled,
    started,
    executionContext,
    requestProviderValues: Array.from(
      { length: compiled.providerRecords.length },
      () => undefined,
    ),
    requestProviderResolved: Array.from(
      { length: compiled.providerRecords.length },
      () => false,
    ),
    providerDisposeOrder: [],
    serviceBindings: Array.from(
      { length: compiled.serviceRecords.length },
      () => undefined,
    ),
    controllerContexts: Array.from(
      { length: compiled.controllerRecords.length },
      () => undefined,
    ),
  };
}

export async function disposeExecutionScope(scope: ExecutionScope): Promise<void> {
  let firstError: unknown;

  const captureError = (error: unknown): void => {
    if (firstError === undefined) {
      firstError = error;
    }
  };

  for (const disposeRecord of [...scope.providerDisposeOrder].reverse()) {
    try {
      await disposeRecord.dispose(disposeRecord.value);
    } catch (error) {
      captureError(error);
    }
  }

  if (firstError !== undefined) {
    throw firstError;
  }
}

export async function resolveTokenMapInScope<TDeps extends TokenMap>(
  deps: TDeps | undefined,
  compiled: CompiledApp,
  started: StartedApp,
  scope: ExecutionScope | undefined,
  ownerId: string,
): Promise<ResolveTokenMap<TDeps>> {
  const resolved: Record<string, unknown> = {};

  for (const [depName, tokenValue] of Object.entries(deps ?? {})) {
    const tokenKey = getTokenKey(tokenValue);
    const providerRecord = compiled.providerByTokenKey.get(tokenKey);

    if (!providerRecord && !isBuiltInExecutionTokenKey(tokenKey)) {
      throw dependencyResolutionError(
        `Unable to resolve dependency "${depName}" from token "${tokenKey}" for "${ownerId}".`,
        {
          ownerId,
          depName,
          tokenKey,
        },
      );
    }

    resolved[depName] = providerRecord
      ? await resolveProviderRecord(compiled, started, providerRecord, scope)
      : resolveBuiltInToken(tokenKey, scope, ownerId, depName);
  }

  return resolved as ResolveTokenMap<TDeps>;
}

function resolveBuiltInToken(
  tokenKey: string,
  scope: ExecutionScope | undefined,
  ownerId: string,
  depName: string,
): unknown {
  if (!scope) {
    throw scopeError(
      `Unable to resolve dependency "${depName}" from token "${tokenKey}" for "${ownerId}" without an execution scope.`,
      {
        ownerId,
        depName,
        tokenKey,
      },
    );
  }

  return resolveBuiltInExecutionToken({
    tokenKey,
    executionContext: scope.executionContext,
  });
}

export async function resolveServiceBinding(
  compiled: CompiledApp,
  started: StartedApp,
  record: ServiceRecord,
  scope?: ExecutionScope,
): Promise<ServiceBinding> {
  const cache = getServiceBindingCache(started, record, scope);
  const cached = cache?.[record.slot];

  if (cached) {
    return cached;
  }

  const deps = await resolveTokenMapInScope(
    record.descriptor.deps,
    compiled,
    started,
    scope,
    record.id,
  );
  const context = deriveDescriptorContext(
    record.descriptor.ctx,
    deps,
    record.id,
    createChildLogger(started.bedrockLogger, {
      moduleName: record.moduleName,
      contextKind: "service",
      contextName: record.descriptor.name,
    }),
  );
  const binding: ServiceBinding = {
    record,
    context,
  };

  if (cache) {
    cache[record.slot] = binding;
  }
  return binding;
}

export async function resolveControllerContext(
  compiled: CompiledApp,
  started: StartedApp,
  record: ControllerRecord,
  scope: ExecutionScope | undefined,
  tools: ControllerContextTools,
): Promise<unknown> {
  const cache = getControllerContextCache(started, record, scope);
  const cached = cache?.[record.slot];

  if (cached !== undefined) {
    return cached;
  }

  const deps = await resolveTokenMapInScope(
    record.descriptor.deps,
    compiled,
    started,
    scope,
    record.id,
  );
  const context = deriveDescriptorContext(
    record.descriptor.ctx,
    deps,
    record.id,
    createChildLogger(started.bedrockLogger, {
      moduleName: record.moduleName,
      contextKind: "controller",
      contextName: record.descriptor.name,
    }),
    tools,
  );

  if (cache) {
    cache[record.slot] = context;
  }
  return context;
}

function getServiceBindingCache(
  started: StartedApp,
  record: ServiceRecord,
  scope?: ExecutionScope,
): Array<ServiceBinding | undefined> | undefined {
  if (record.depScope === "singleton") {
    return started.singletonServiceBindings;
  }

  if (record.depScope === "request") {
    if (!scope) {
      throw bootError(
        `Service "${record.id}" requires an execution scope because it depends on request-scoped providers.`,
        {
          serviceId: record.id,
          scope: record.depScope,
        },
      );
    }

    return scope.serviceBindings;
  }

  return undefined;
}

function getControllerContextCache(
  started: StartedApp,
  record: ControllerRecord,
  scope?: ExecutionScope,
): unknown[] | undefined {
  if (record.descriptor.ctx && record.descriptor.ctx.length >= 2) {
    return undefined;
  }

  if (record.depScope === "singleton") {
    return started.singletonControllerContexts;
  }

  if (record.depScope === "request") {
    if (!scope) {
      throw bootError(
        `Controller "${record.id}" requires an execution scope because it depends on request-scoped providers.`,
        {
          controllerId: record.id,
          scope: record.depScope,
        },
      );
    }

    return scope.controllerContexts;
  }

  return undefined;
}

export async function resolveProviderRecord(
  compiled: CompiledApp,
  started: StartedApp,
  record: ProviderRecord,
  scope?: ExecutionScope,
): Promise<unknown> {
  if (record.scope === "singleton") {
    if (started.singletonProviderResolved[record.slot]) {
      return started.singletonProviderValues[record.slot];
    }

    const value = await instantiateProviderValue(compiled, started, record, scope);
    started.singletonProviderValues[record.slot] = value;
    started.singletonProviderResolved[record.slot] = true;
    pushDisposeRecord(started.singletonProviderDisposeOrder, record, value);
    return value;
  }

  if (!scope) {
    throw scopeError(
      `Provider "${record.tokenKey}" with scope "${record.scope}" requires an execution scope.`,
      {
        tokenKey: record.tokenKey,
        scope: record.scope,
      },
    );
  }

  if (record.scope === "request") {
    if (scope.requestProviderResolved[record.slot]) {
      return scope.requestProviderValues[record.slot];
    }

    const value = await instantiateProviderValue(compiled, started, record, scope);
    scope.requestProviderValues[record.slot] = value;
    scope.requestProviderResolved[record.slot] = true;
    pushDisposeRecord(scope.providerDisposeOrder, record, value);
    return value;
  }

  const value = await instantiateProviderValue(compiled, started, record, scope);
  pushDisposeRecord(scope.providerDisposeOrder, record, value);
  return value;
}

async function instantiateProviderValue(
  compiled: CompiledApp,
  started: StartedApp,
  record: ProviderRecord,
  scope?: ExecutionScope,
): Promise<unknown> {
  if (isExistingProvider(record.descriptor)) {
    const aliasTargetKey = record.aliasToTokenKey;

    if (!aliasTargetKey) {
      throw dependencyResolutionError(
        `Provider alias "${record.tokenKey}" has no target token.`,
        {
          tokenKey: record.tokenKey,
        },
      );
    }

    const aliasTarget = compiled.providerByTokenKey.get(aliasTargetKey);

    if (!aliasTarget) {
      throw dependencyResolutionError(
        `Provider alias "${record.tokenKey}" depends on missing token "${aliasTargetKey}".`,
        {
          tokenKey: record.tokenKey,
          aliasTargetKey,
        },
      );
    }

    return resolveProviderRecord(compiled, started, aliasTarget, scope);
  }

  if (isFactoryProvider(record.descriptor)) {
    const deps = await resolveTokenMapInScope(
      record.descriptor.deps as TokenMap | undefined,
      compiled,
      started,
      scope,
      record.id,
    );

    try {
      return await record.descriptor.useFactory(deps);
    } catch (error) {
      throw wrapBootFailure(
        error,
        `Failed to resolve provider "${record.tokenKey}".`,
      );
    }
  }

  return record.descriptor.useValue;
}

function pushDisposeRecord(
  disposeOrder: ProviderDisposeRecord[],
  record: ProviderRecord,
  value: unknown,
): void {
  if (!isFactoryProvider(record.descriptor) || !record.descriptor.dispose) {
    return;
  }

  disposeOrder.push({
    tokenKey: record.tokenKey,
    scope: record.scope,
    value,
    dispose: record.descriptor.dispose as (value: unknown) => Promise<void> | void,
  });
}
