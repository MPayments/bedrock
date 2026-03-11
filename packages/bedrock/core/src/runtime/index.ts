import { z } from "zod";

import { bootError, dependencyResolutionError, scopeError } from "@bedrock/common";

import { createAppExecutionContext } from "../execution-context";
import { getTokenKey, type Token } from "../kernel";
import type { ServiceActionHandle } from "../service";
import { createExecutionScope, disposeExecutionScope } from "./scope";
import { executeServiceAction } from "./actions";
import { compileApp } from "./compile";
import { startCompiledApp, stopStartedApp } from "./lifecycle";
import { createWorkerDispatch, resolveRegisteredWorkerTrigger } from "./workers";
import type { AppDescriptor, AppRuntime, CompiledApp, StartedApp } from "./types";

export function createApp(def: AppDescriptor): AppRuntime {
  let compiled: CompiledApp | null = null;
  let started: StartedApp | null = null;

  const ensureCompiled = (): CompiledApp => {
    compiled ??= compileApp(def);
    return compiled;
  };

  const ensureStarted = (): StartedApp => {
    if (!started) {
      throw bootError("App has not been started.");
    }

    return started;
  };

  const call = (async (
    action: ServiceActionHandle<any, any, any, any, any>,
    input?: unknown,
  ) => {
    const current = ensureStarted();
    const compiledApp = ensureCompiled();
    const scope = createExecutionScope(
      compiledApp,
      current,
      createAppExecutionContext(),
    );

    try {
      if (action.input instanceof z.ZodUndefined) {
        return await executeServiceAction(
          compiledApp,
          current,
          scope,
          action as ServiceActionHandle<any, any, z.ZodUndefined, any, any>,
        );
      }

      return await executeServiceAction(
        compiledApp,
        current,
        scope,
        action,
        input as never,
      );
    } finally {
      await disposeExecutionScope(scope);
    }
  }) as AppRuntime["call"];

  const dispatch = ((
    trigger: unknown,
    inputOrOptions?: unknown,
    options?: unknown,
  ) => createWorkerDispatch(ensureCompiled(), ensureStarted())(
    trigger as never,
    inputOrOptions as never,
    options as never,
  )) as AppRuntime["dispatch"];
  const resolveWorkerTrigger = ((trigger: unknown) =>
    resolveRegisteredWorkerTrigger(ensureCompiled(), trigger as never)
  ) as AppRuntime["resolveWorkerTrigger"];

  return {
    async start() {
      if (started) {
        return;
      }

      const compiledApp = ensureCompiled();
      started = await startCompiledApp(compiledApp);
    },

    async stop() {
      if (!started) {
        return;
      }

      const current = started;
      started = null;
      await stopStartedApp(ensureCompiled(), current);
    },

    get<T>(tokenValue: Token<T>) {
      const current = ensureStarted();
      const tokenKey = getTokenKey(tokenValue);
      const providerRecord = ensureCompiled().providerByTokenKey.get(tokenKey);

      if (!providerRecord) {
        throw dependencyResolutionError(
          `No provider is registered for token "${tokenKey}".`,
          { tokenKey },
        );
      }

      if (providerRecord.scope !== "singleton") {
        throw scopeError(
          `Token "${tokenKey}" cannot be resolved via app.get() because it uses "${providerRecord.scope}" scope.`,
          {
            tokenKey,
            scope: providerRecord.scope,
          },
        );
      }

      if (!current.singletonProviderResolved[providerRecord.slot]) {
        throw dependencyResolutionError(
          `No provider is registered for token "${tokenKey}".`,
          { tokenKey },
        );
      }

      return current.singletonProviderValues[providerRecord.slot] as T;
    },

    call,
    dispatch,
    resolveWorkerTrigger,

    async fetch(request: Request): Promise<Response> {
      ensureStarted();
      const httpAdapter = ensureCompiled().httpAdapter;

      if (!httpAdapter) {
        throw bootError("App has no HTTP adapter configured.");
      }

      return httpAdapter.fetch(request);
    },

    inspect() {
      return ensureCompiled().graph;
    },
  };
}

export type { AppDescriptor, AppLoggerConfig, AppRuntime } from "./types";
