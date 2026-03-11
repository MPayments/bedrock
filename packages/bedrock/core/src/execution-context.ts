import { bedrockError } from "@bedrock/common";

import { freezeObject } from "./immutability";
import { type HttpRequestData, type RuntimeHttpRequest } from "./http";
import { token } from "./kernel";
import type { WorkerDelivery } from "./worker-trigger";

export type HttpRouteMeta = {
  id: string;
  controllerId: string;
  method: string;
  fullPath: string;
  tags: readonly string[];
};

export type ExecutionContext = {
  kind: "app" | "http" | "worker";
  http?: {
    request: RuntimeHttpRequest;
    requestData: HttpRequestData;
    route: HttpRouteMeta;
  };
  worker?: {
    delivery: WorkerDelivery;
    triggerId: string;
    workerId: string;
  };
};

export const ExecutionContextToken = token<ExecutionContext>(
  "bedrock.execution-context",
);

export const HttpRequestDataToken = token<HttpRequestData>(
  "bedrock.http-request-data",
);

export const HttpRouteMetaToken = token<HttpRouteMeta>(
  "bedrock.http-route-meta",
);

export const WorkerDeliveryToken = token<WorkerDelivery>(
  "bedrock.worker-delivery",
);

const builtInExecutionTokenKeys = new Set([
  ExecutionContextToken.key,
  HttpRequestDataToken.key,
  HttpRouteMetaToken.key,
  WorkerDeliveryToken.key,
]);

export function createAppExecutionContext(): ExecutionContext {
  return freezeObject({
    kind: "app",
  });
}

export function createHttpExecutionContext(args: {
  request: RuntimeHttpRequest;
  getRequestData(): HttpRequestData;
  route: HttpRouteMeta;
}): ExecutionContext {
  let httpContext: NonNullable<ExecutionContext["http"]> | undefined;

  return freezeObject({
    kind: "http",
    get http() {
      return (httpContext ??= createLazyHttpContext(args));
    },
  });
}

export function createWorkerExecutionContext(args: {
  delivery: WorkerDelivery;
  triggerId: string;
  workerId: string;
}): ExecutionContext {
  return freezeObject({
    kind: "worker",
    worker: freezeObject({
      delivery: args.delivery,
      triggerId: args.triggerId,
      workerId: args.workerId,
    }),
  });
}

export function isBuiltInExecutionTokenKey(tokenKey: string): boolean {
  return builtInExecutionTokenKeys.has(tokenKey);
}

export function getBuiltInExecutionTokenScope(
  tokenKey: string,
): "request" | undefined {
  return isBuiltInExecutionTokenKey(tokenKey) ? "request" : undefined;
}

export function resolveBuiltInExecutionToken(args: {
  tokenKey: string;
  executionContext: ExecutionContext;
}): unknown {
  switch (args.tokenKey) {
    case ExecutionContextToken.key:
      return args.executionContext;
    case HttpRequestDataToken.key:
      return requireHttpContext(args.executionContext).requestData;
    case HttpRouteMetaToken.key:
      return requireHttpContext(args.executionContext).route;
    case WorkerDeliveryToken.key:
      return requireWorkerContext(args.executionContext).delivery;
    default:
      return undefined;
  }
}

function requireHttpContext(
  executionContext: ExecutionContext,
): NonNullable<ExecutionContext["http"]> {
  if (executionContext.kind === "http" && executionContext.http) {
    return executionContext.http;
  }

  throw bedrockError({
    message: "HTTP execution context is unavailable.",
    code: "BEDROCK_EXECUTION_CONTEXT_UNAVAILABLE",
    details: {
      expected: "http",
      actual: executionContext.kind,
    },
  });
}

function requireWorkerContext(
  executionContext: ExecutionContext,
): NonNullable<ExecutionContext["worker"]> {
  if (executionContext.kind === "worker" && executionContext.worker) {
    return executionContext.worker;
  }

  throw bedrockError({
    message: "Worker execution context is unavailable.",
    code: "BEDROCK_EXECUTION_CONTEXT_UNAVAILABLE",
    details: {
      expected: "worker",
      actual: executionContext.kind,
    },
  });
}

function createLazyHttpContext(args: {
  request: RuntimeHttpRequest;
  getRequestData(): HttpRequestData;
  route: HttpRouteMeta;
}): NonNullable<ExecutionContext["http"]> {
  let requestData: HttpRequestData | undefined;

  return freezeObject({
    request: args.request,
    get requestData() {
      return (requestData ??= args.getRequestData());
    },
    route: args.route,
  });
}
