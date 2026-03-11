import {
  error as createHandlerErrorResult,
  isErrorResult,
  dependencyResolutionError,
} from "@bedrock/common";

import {
  type AnyCustomRouteDef,
  type ControllerCall,
  type ControllerContextTools,
  type ControllerRequestData,
  isActionRoute,
} from "../controller";
import { createHttpExecutionContext } from "../execution-context";
import {
  createHttpRequestParser,
  createHttpRouteResponseFinalizer,
  finalizeHttpErrorResponse,
} from "../http-runtime";
import type {
  BoundHttpMount,
  BoundHttpRoute,
  HttpRequestObserver,
  RuntimeHttpRequest,
  RuntimeHttpResult,
} from "../http";
import { freezeObject } from "../immutability";
import { createNoopLogger } from "../logging";
import {
  enforceRouteErrorContract,
  mapDomainErrorToBedrockError,
  mapPublicHttpErrorToBedrockError,
  type RouteErrorsConfig,
} from "../route-errors";
import { isNoInputSchema } from "../service";
import { executeServiceAction } from "./actions";
import { createChildLogger, resolveAppLogger } from "./logger";
import {
  createExecutionScope,
  disposeExecutionScope,
  resolveControllerContext,
  resolveProviderRecord,
  resolveServiceBinding,
} from "./scope";
import {
  createAppInitContext,
  runMiddleware,
  wrapAdapterFailure,
  wrapBootFailure,
} from "./support";
import { createWorkerRuntimeBridge } from "./workers";
import type {
  CompiledApp,
  ControllerRecord,
  RouteRecord,
  StartedApp,
} from "./types";

type BoundRouteArgs = {
  ctx: unknown;
  request: ControllerRequestData<any>;
  params: unknown;
  query: unknown;
  headers: unknown;
  cookies: unknown;
  body: unknown;
  call: ControllerCall<any>;
  error: typeof createHandlerErrorResult;
};

type PreparedRouteMiddleware = {
  allowedInternalCodes?: ReadonlySet<string>;
  run(args: object): Promise<unknown>;
};

export async function startCompiledApp(compiled: CompiledApp): Promise<StartedApp> {
  const partialStarted: StartedApp = {
    bedrockLogger: createNoopLogger(),
    singletonProviderValues: Array.from(
      { length: compiled.providerRecords.length },
      () => undefined,
    ),
    singletonProviderResolved: Array.from(
      { length: compiled.providerRecords.length },
      () => false,
    ),
    singletonServiceBindings: Array.from(
      { length: compiled.serviceRecords.length },
      () => undefined,
    ),
    singletonControllerContexts: Array.from(
      { length: compiled.controllerRecords.length },
      () => undefined,
    ),
    serviceInitOrder: [],
    moduleInitOrder: [],
    singletonProviderDisposeOrder: [],
    httpRoutesRegistered: false,
    startedWorkerAdapters: [],
    inFlightWorkerExecutions: new Set(),
  };

  try {
    for (const providerRecord of compiled.providerOrder) {
      if (providerRecord.scope !== "singleton") {
        continue;
      }

      await resolveProviderRecord(compiled, partialStarted, providerRecord);
    }

    partialStarted.bedrockLogger = resolveAppLogger(
      compiled.loggerConfig,
      compiled,
      partialStarted,
    );
    partialStarted.bedrockLogger?.info("bedrock.app.start.begin");

    for (const serviceRecord of compiled.serviceRecords) {
      if (serviceRecord.depScope !== "singleton") {
        continue;
      }

      if (
        !serviceRecord.descriptor.hooks?.onInit &&
        !serviceRecord.descriptor.hooks?.onDispose
      ) {
        continue;
      }

      const binding = await resolveServiceBinding(compiled, partialStarted, serviceRecord);

      if (serviceRecord.descriptor.hooks?.onInit) {
        await serviceRecord.descriptor.hooks.onInit({ ctx: binding.context } as never);
      }

      partialStarted.serviceInitOrder.push(binding);
    }

    const boundHttpRoutes: BoundHttpRoute[] = compiled.controllerRecords.flatMap(
      (controllerRecord) =>
        controllerRecord.routes.map((routeRecord) =>
          bindHttpRoute(compiled, partialStarted, controllerRecord, routeRecord),
        ),
    );
    const boundHttpMounts: BoundHttpMount[] = compiled.httpMountRecords.map((record) => ({
      id: record.id,
      moduleName: record.moduleName,
      name: record.descriptor.name,
      basePath: record.descriptor.basePath,
      fullPath: record.fullPath,
      handle: async (request) => Promise.resolve(record.descriptor.handle(request)),
    }));

    const appInitContext = createAppInitContext(
      compiled.graph,
      partialStarted.singletonProviderValues,
      partialStarted.singletonProviderResolved,
      compiled.providerByTokenKey,
    );

    for (const moduleRecord of compiled.moduleRecords) {
      if (moduleRecord.descriptor.hooks?.onInit) {
        await moduleRecord.descriptor.hooks.onInit(appInitContext);
      }

      partialStarted.moduleInitOrder.push(moduleRecord);
    }

    if (compiled.httpAdapter) {
      try {
        partialStarted.bedrockLogger?.info("bedrock.http.register.begin", {
          routeCount: boundHttpRoutes.length,
          mountCount: boundHttpMounts.length,
        });
        compiled.httpAdapter.registerRoutes(boundHttpRoutes, {
          mounts: boundHttpMounts,
          observer: createHttpRequestObserver(compiled, partialStarted),
        });
        partialStarted.httpRoutesRegistered = true;
        partialStarted.bedrockLogger?.info("bedrock.http.register.success", {
          routeCount: boundHttpRoutes.length,
          mountCount: boundHttpMounts.length,
        });
      } catch (error) {
        partialStarted.bedrockLogger?.error("bedrock.http.register.failure", {
          routeCount: boundHttpRoutes.length,
          mountCount: boundHttpMounts.length,
          error,
        });
        throw wrapAdapterFailure(error, "Failed to register HTTP routes.");
      }
    }

    const workerRuntimeBridge = createWorkerRuntimeBridge(compiled, partialStarted);

    for (const workerAdapter of compiled.workerAdapterByName.values()) {
      try {
        partialStarted.bedrockLogger?.info("bedrock.worker.register.begin", {
          adapter: workerAdapter.name,
        });
        await workerAdapter.registerTriggers(
          compiled.workerTriggerRecords
            .filter((record) => record.adapterName === workerAdapter.name)
            .map((record) => record.registeredTrigger),
          workerRuntimeBridge,
        );
        partialStarted.bedrockLogger?.info("bedrock.worker.register.success", {
          adapter: workerAdapter.name,
        });
      } catch (error) {
        partialStarted.bedrockLogger?.error("bedrock.worker.register.failure", {
          adapter: workerAdapter.name,
          error,
        });
        throw wrapAdapterFailure(
          error,
          `Failed to register worker triggers for adapter "${workerAdapter.name}".`,
        );
      }
    }

    if (compiled.httpAdapter) {
      try {
        partialStarted.bedrockLogger?.info("bedrock.http.start.begin");
        await compiled.httpAdapter.start();
        partialStarted.bedrockLogger?.info("bedrock.http.start.success");
      } catch (error) {
        partialStarted.bedrockLogger?.error("bedrock.http.start.failure", {
          error,
        });
        throw wrapAdapterFailure(error, "Failed to start HTTP adapter.");
      }
    }

    for (const workerAdapter of compiled.workerAdapterByName.values()) {
      try {
        partialStarted.bedrockLogger?.info("bedrock.worker.start.begin", {
          adapter: workerAdapter.name,
        });
        await workerAdapter.start();
        partialStarted.startedWorkerAdapters.push(workerAdapter);
        partialStarted.bedrockLogger?.info("bedrock.worker.start.success", {
          adapter: workerAdapter.name,
        });
      } catch (error) {
        partialStarted.bedrockLogger?.error("bedrock.worker.start.failure", {
          adapter: workerAdapter.name,
          error,
        });
        throw wrapAdapterFailure(
          error,
          `Failed to start worker adapter "${workerAdapter.name}".`,
        );
      }
    }

    partialStarted.bedrockLogger?.info("bedrock.app.start.success", {
      http: compiled.httpAdapter ? true : false,
      workerAdapterCount: partialStarted.startedWorkerAdapters.length,
    });
    return partialStarted;
  } catch (error) {
    partialStarted.bedrockLogger?.error("bedrock.app.start.failure", {
      error,
    });
    try {
      await stopStartedApp(compiled, partialStarted);
    } catch {
      // Prefer surfacing the original startup error.
    }
    throw wrapBootFailure(error, "Failed to start app.");
  }
}

export async function stopStartedApp(
  compiled: CompiledApp,
  started: StartedApp,
): Promise<void> {
  started.bedrockLogger?.info("bedrock.app.stop.begin", {
    http: compiled.httpAdapter ? true : false,
    workerAdapterCount: started.startedWorkerAdapters.length,
  });
  const appInitContext = createAppInitContext(
    compiled.graph,
    started.singletonProviderValues,
    started.singletonProviderResolved,
    compiled.providerByTokenKey,
  );
  let firstError: unknown;

  const captureError = (error: unknown): void => {
    if (firstError === undefined) {
      firstError = error;
    }
  };

  if (compiled.httpAdapter && started.httpRoutesRegistered) {
    try {
      started.bedrockLogger?.info("bedrock.http.stop.begin");
      await compiled.httpAdapter.stop();
      started.bedrockLogger?.info("bedrock.http.stop.success");
    } catch (error) {
      started.bedrockLogger?.error("bedrock.http.stop.failure", {
        error,
      });
      captureError(wrapAdapterFailure(error, "Failed to stop HTTP adapter."));
    }
  }

  for (const workerAdapter of [...started.startedWorkerAdapters].reverse()) {
    try {
      started.bedrockLogger?.info("bedrock.worker.stop.begin", {
        adapter: workerAdapter.name,
      });
      await workerAdapter.stop({
        drain: workerAdapter.capabilities.drain,
      });
      started.bedrockLogger?.info("bedrock.worker.stop.success", {
        adapter: workerAdapter.name,
      });
    } catch (error) {
      started.bedrockLogger?.error("bedrock.worker.stop.failure", {
        adapter: workerAdapter.name,
        error,
      });
      captureError(
        wrapAdapterFailure(
          error,
          `Failed to stop worker adapter "${workerAdapter.name}".`,
        ),
      );
    }
  }

  if (started.inFlightWorkerExecutions.size > 0) {
    const results = await Promise.allSettled(started.inFlightWorkerExecutions);

    for (const result of results) {
      if (result.status === "rejected") {
        captureError(result.reason);
      }
    }
  }

  for (const moduleRecord of [...started.moduleInitOrder].reverse()) {
    if (moduleRecord.descriptor.hooks?.onDispose) {
      try {
        await moduleRecord.descriptor.hooks.onDispose(appInitContext);
      } catch (error) {
        captureError(error);
      }
    }
  }

  for (const binding of [...started.serviceInitOrder].reverse()) {
    if (binding.record.descriptor.hooks?.onDispose) {
      try {
        await binding.record.descriptor.hooks.onDispose({ ctx: binding.context } as never);
      } catch (error) {
        captureError(error);
      }
    }
  }

  for (const providerDisposeRecord of [...started.singletonProviderDisposeOrder].reverse()) {
    try {
      await providerDisposeRecord.dispose(providerDisposeRecord.value);
    } catch (error) {
      captureError(error);
    }
  }

  if (firstError !== undefined) {
    started.bedrockLogger?.error("bedrock.app.stop.failure", {
      error: firstError,
    });
    throw firstError;
  }

  started.bedrockLogger?.info("bedrock.app.stop.success");
}

function bindHttpRoute(
  compiled: CompiledApp,
  started: StartedApp,
  controllerRecord: ControllerRecord,
  routeRecord: RouteRecord,
): BoundHttpRoute {
  const parseRequest = createHttpRequestParser({
    routeId: routeRecord.id,
    requestSpec: routeRecord.descriptor.request,
  });
  const finalizeRouteResponse = createHttpRouteResponseFinalizer({
    routeId: routeRecord.id,
    responses: routeRecord.descriptor.responses,
  });
  const routeMiddleware = createPreparedRouteMiddleware(routeRecord);
  const routeActionNeedsRequestScope = getRouteActionNeedsRequestScope(compiled, routeRecord);
  const routeExecutionMeta = freezeObject({
    id: routeRecord.id,
    controllerId: routeRecord.controllerId,
    method: routeRecord.descriptor.method,
    fullPath: routeRecord.fullPath,
    tags: freezeObject([...routeRecord.tags]),
  });

  return {
    id: routeRecord.id,
    controllerId: routeRecord.controllerId,
    moduleName: controllerRecord.moduleName,
    controllerName: controllerRecord.descriptor.name,
    routeName: routeRecord.name,
    method: routeRecord.descriptor.method,
    path: routeRecord.path,
    fullPath: routeRecord.fullPath,
    summary: routeRecord.summary,
    description: routeRecord.description,
    tags: routeRecord.tags,
    execute: ({ request }) =>
      executeBoundHttpRoute({
        compiled,
        started,
        controllerRecord,
        routeRecord,
        request,
        parseRequest,
        finalizeRouteResponse,
        routeMiddleware,
        controllerNeedsRequestScope: controllerRecord.depScope === "request",
        routeActionNeedsRequestScope,
        routeExecutionMeta,
      }),
  };
}

async function executeBoundHttpRoute(args: {
  compiled: CompiledApp;
  started: StartedApp;
  controllerRecord: ControllerRecord;
  routeRecord: RouteRecord;
  request: RuntimeHttpRequest;
  parseRequest: ReturnType<typeof createHttpRequestParser>;
  finalizeRouteResponse: ReturnType<typeof createHttpRouteResponseFinalizer>;
  routeMiddleware: readonly PreparedRouteMiddleware[];
  controllerNeedsRequestScope: boolean;
  routeActionNeedsRequestScope: boolean;
  routeExecutionMeta: {
    id: string;
    controllerId: string;
    method: string;
    fullPath: string;
    tags: readonly string[];
  };
}): Promise<RuntimeHttpResult> {
  try {
    const parsed = await args.parseRequest({
      request: args.request,
    });
    let scope: ReturnType<typeof createExecutionScope> | undefined;
    const getScope = () =>
      (scope ??= createExecutionScope(
        args.compiled,
        args.started,
        createHttpExecutionContext({
          request: args.request,
          getRequestData: parsed.getRequestData,
          route: args.routeExecutionMeta,
        }),
      ));

    try {
      const getRouteCall = createLazyControllerCall(
        args.compiled,
        args.started,
        getScope,
        args.routeRecord,
      );
      const context = await resolveControllerContext(
        args.compiled,
        args.started,
        args.controllerRecord,
        args.controllerNeedsRequestScope ? getScope() : undefined,
        createControllerContextTools(getRouteCall),
      );
      const routeArgs = createRouteHandlerArgs({
        ctx: context,
        request: parsed.parsedRequestData as ControllerRequestData<any>,
        getCall: getRouteCall,
      });
      const result =
        args.routeMiddleware.length === 0
          ? await executeRouteHandler({
              compiled: args.compiled,
              started: args.started,
              getScope,
              routeRecord: args.routeRecord,
              routeActionNeedsRequestScope: args.routeActionNeedsRequestScope,
              routeArgs,
            })
          : await runMiddleware(
              routeArgs,
              args.routeMiddleware,
              (currentArgs) =>
                executeRouteHandler({
                  compiled: args.compiled,
                  started: args.started,
                  getScope,
                  routeRecord: args.routeRecord,
                  routeActionNeedsRequestScope: args.routeActionNeedsRequestScope,
                  routeArgs: currentArgs,
                }),
              (middleware, currentArgs, next) =>
                createRouteMiddlewareArgs({
                  routeArgs: currentArgs,
                  next,
                  getCall: createLazyControllerCall(
                    args.compiled,
                    args.started,
                    getScope,
                    args.routeRecord,
                    middleware.allowedInternalCodes,
                  ),
                }),
            );

      return await args.finalizeRouteResponse({
        result,
      });
    } finally {
      if (scope) {
        await disposeExecutionScope(scope);
      }
    }
  } catch (error) {
    return finalizeHttpErrorResponse({
      error: enforceRouteErrorContract({
        error,
        contract: args.routeRecord.errorContract,
      }),
    });
  }
}

function createPreparedRouteMiddleware(
  routeRecord: RouteRecord,
): readonly PreparedRouteMiddleware[] {
  return (routeRecord.descriptor.middleware ?? []).map((descriptor) => {
    const allowedPublicCodes = getDeclaredPublicCodes(descriptor.errors);
    const allowedInternalCodes = getDeclaredInternalCodes(descriptor.errors);

    return {
      allowedInternalCodes,
      run: async (currentArgs: object) => {
        const result = await descriptor.run(currentArgs as never);

        if (isErrorResult(result)) {
          throw mapPublicHttpErrorToBedrockError({
            routeId: routeRecord.id,
            contract: routeRecord.errorContract,
            error: result.error,
            allowedPublicCodes,
          });
        }

        return result;
      },
    };
  });
}

function getRouteActionNeedsRequestScope(
  compiled: CompiledApp,
  routeRecord: RouteRecord,
): boolean {
  if (!isActionRoute(routeRecord.descriptor)) {
    return false;
  }

  const serviceRecord = compiled.serviceRecordByDescriptor.get(
    routeRecord.descriptor.handler.service as object,
  );

  if (!serviceRecord) {
    throw dependencyResolutionError(
      `Controller route "${routeRecord.id}" targets a service action that is not registered in this app.`,
      {
        routeId: routeRecord.id,
        actionName: routeRecord.descriptor.handler.name,
        serviceName: routeRecord.descriptor.handler.service.name,
      },
    );
  }

  return serviceRecord.depScope === "request";
}

function createControllerContextTools(
  getCall: () => ControllerCall<any>,
): ControllerContextTools {
  return {
    get call() {
      return getCall();
    },
  };
}

function createRouteHandlerArgs(args: {
  ctx: unknown;
  request: ControllerRequestData<any>;
  getCall: () => ControllerCall<any>;
}): BoundRouteArgs {
  return {
    ctx: args.ctx,
    request: args.request,
    params: args.request.params,
    query: args.request.query,
    headers: args.request.headers,
    cookies: args.request.cookies,
    body: args.request.body,
    get call() {
      return args.getCall();
    },
    error: createHandlerErrorResult,
  };
}

function createRouteMiddlewareArgs(args: {
  routeArgs: BoundRouteArgs;
  next: () => Promise<unknown>;
  getCall: () => ControllerCall<any>;
}): BoundRouteArgs & {
  next: () => Promise<unknown>;
} {
  return {
    ctx: args.routeArgs.ctx,
    request: args.routeArgs.request,
    params: args.routeArgs.params,
    query: args.routeArgs.query,
    headers: args.routeArgs.headers,
    cookies: args.routeArgs.cookies,
    body: args.routeArgs.body,
    get call() {
      return args.getCall();
    },
    error: args.routeArgs.error,
    next: args.next,
  };
}

async function executeRouteHandler(args: {
  compiled: CompiledApp;
  started: StartedApp;
  getScope: () => ReturnType<typeof createExecutionScope>;
  routeRecord: RouteRecord;
  routeActionNeedsRequestScope: boolean;
  routeArgs: BoundRouteArgs;
}): Promise<unknown> {
  const routeDescriptor = args.routeRecord.descriptor;

  if (isActionRoute(routeDescriptor)) {
    const select = routeDescriptor.select;

    if (!select) {
      throw dependencyResolutionError(
        `Controller route "${args.routeRecord.id}" requires an explicit select() because the action input cannot be inferred from the route request contract.`,
        { routeId: args.routeRecord.id },
      );
    }

    const selectedInput = select(args.routeArgs.request as never);
    const result = await executeServiceAction(
      args.compiled,
      args.started,
      args.routeActionNeedsRequestScope ? args.getScope() : undefined,
      routeDescriptor.handler,
      selectedInput as never,
    );

    if (!result.ok) {
      throw mapDomainErrorToBedrockError({
        routeId: args.routeRecord.id,
        contract: args.routeRecord.errorContract,
        error: result.error,
        allowedInternalCodes: getDeclaredInternalCodes(routeDescriptor.errors),
      });
    }

    return result.value;
  }

  const result = await (routeDescriptor as AnyCustomRouteDef<any>).handler(args.routeArgs as never);

  if (isErrorResult(result)) {
    throw mapPublicHttpErrorToBedrockError({
      routeId: args.routeRecord.id,
      contract: args.routeRecord.errorContract,
      error: result.error,
    });
  }

  return result;
}

function createLazyControllerCall(
  compiled: CompiledApp,
  started: StartedApp,
  getScope: () => ReturnType<typeof createExecutionScope>,
  routeRecord: RouteRecord,
  allowedInternalCodes?: ReadonlySet<string>,
): () => ControllerCall<any> {
  let call: ControllerCall<any> | undefined;

  return () =>
    (call ??= createMappedControllerCall(
      compiled,
      started,
      getScope,
      routeRecord,
      allowedInternalCodes,
    ));
}

function createMappedControllerCall(
  compiled: CompiledApp,
  started: StartedApp,
  getScope: () => ReturnType<typeof createExecutionScope>,
  routeRecord: RouteRecord,
  allowedInternalCodes?: ReadonlySet<string>,
): ControllerCall<any> {
  return (async (
    action: any,
    input?: unknown,
  ) => {
    const actionScope = resolveActionExecutionScope(compiled, action, getScope);
    const result = isNoInputSchema(action.input)
      ? await executeServiceAction(compiled, started, actionScope, action)
      : await executeServiceAction(compiled, started, actionScope, action, input);

    if (result.ok) {
      return result.value;
    }

    throw mapDomainErrorToBedrockError({
      routeId: routeRecord.id,
      contract: routeRecord.errorContract,
      error: result.error,
      allowedInternalCodes,
    });
  }) as ControllerCall<any>;
}

function resolveActionExecutionScope(
  compiled: CompiledApp,
  action: {
    service: object;
  },
  getScope: () => ReturnType<typeof createExecutionScope>,
): ReturnType<typeof createExecutionScope> | undefined {
  const serviceRecord = compiled.serviceRecordByDescriptor.get(action.service as object);

  return serviceRecord?.depScope === "request" ? getScope() : undefined;
}

function createHttpRequestObserver(
  compiled: CompiledApp,
  started: StartedApp,
): HttpRequestObserver | undefined {
  if (compiled.loggerConfig?.enabled === false) {
    return undefined;
  }

  if (compiled.loggerConfig?.http === false || compiled.loggerConfig?.http?.enabled === false) {
    return undefined;
  }

  const includeQuery = compiled.loggerConfig?.http?.includeQuery ?? false;
  const includeHeaders = compiled.loggerConfig?.http?.includeHeaders ?? false;

  return {
    onComplete(entry) {
      const logger = entry.matched && entry.moduleName && entry.controllerName
        ? createChildLogger(started.bedrockLogger, {
            moduleName: entry.moduleName,
            contextKind: "controller",
            contextName: entry.controllerName,
          })
        : started.bedrockLogger;
      const level =
        entry.status >= 500 ? "error" : entry.status >= 400 ? "warn" : "info";
      const fields: Record<string, unknown> = {
        method: entry.method,
        pathname: entry.pathname,
        status: entry.status,
        durationMs: entry.durationMs,
        matched: entry.matched,
      };

      if (entry.routeName) {
        fields.routeName = entry.routeName;
      }
      if (entry.routePath) {
        fields.routePath = entry.routePath;
      }
      if (entry.fullPath) {
        fields.fullPath = entry.fullPath;
      }
      if (entry.moduleName) {
        fields.moduleName = entry.moduleName;
      }
      if (entry.controllerName) {
        fields.controllerName = entry.controllerName;
      }
      if (includeQuery && entry.query) {
        fields.query = entry.query;
      }
      if (includeHeaders && entry.headers) {
        fields.headers = pickIncludedHeaders(entry.headers, includeHeaders);
      }

      logger[level](
        `${entry.method} ${entry.pathname} ${entry.status} +${Math.max(
          Math.round(entry.durationMs),
          0,
        )}ms`,
        fields,
      );
    },
  };
}

function pickIncludedHeaders(
  headers: Record<string, string>,
  includeHeaders: readonly string[],
): Record<string, string> | undefined {
  const picked: Record<string, string> = {};

  for (const headerName of includeHeaders) {
    const value = headers[headerName.toLowerCase()];
    if (value !== undefined) {
      picked[headerName.toLowerCase()] = value;
    }
  }

  return Object.keys(picked).length > 0 ? picked : undefined;
}

function getDeclaredInternalCodes(
  errors: RouteErrorsConfig | undefined,
): ReadonlySet<string> | undefined {
  const codes = Object.keys(errors ?? {});

  return codes.length === 0 ? undefined : new Set(codes);
}

function getDeclaredPublicCodes(
  errors: RouteErrorsConfig | undefined,
): ReadonlySet<string> | undefined {
  const codes = Object.values(errors ?? {}).map((descriptor) => descriptor.code);

  return codes.length === 0 ? undefined : new Set(codes);
}
