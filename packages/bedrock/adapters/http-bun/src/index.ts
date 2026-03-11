import {
  bedrockError,
  isBedrockError,
  notFoundError,
} from "@bedrock/common";
import {
  createRuntimeHttpRequestFromWebRequest,
  runtimeHttpResultToResponse,
  type BoundHttpMount,
  type BoundHttpRoute,
  type HttpAdapter,
  type HttpErrorMapper,
  type HttpRequestLogEntry,
  type HttpRequestObserver,
  type RuntimeHttpRequest,
  type RuntimeHttpResult,
} from "@bedrock/core";

import { Bun } from "./bun-runtime";

type BunServer = ReturnType<(typeof Bun)["serve"]>;

type BunParamRoute = {
  route: BoundHttpRoute;
  method: string;
  parts: readonly string[];
};

type BunHttpMount = {
  mount: BoundHttpMount;
  normalizedPath: string;
};

export type BunHttpAdapterOptions = {
  basePath?: string;
  listen?: false | {
    port?: number;
    hostname?: string;
  };
  onError?: HttpErrorMapper;
};

export function createBunHttpAdapter(
  options: BunHttpAdapterOptions = {},
): HttpAdapter {
  let routes: readonly BoundHttpRoute[] = [];
  let exactRoutes = new Map<string, BoundHttpRoute>();
  let paramRoutes: readonly BunParamRoute[] = [];
  let mounts: readonly BoundHttpMount[] = [];
  let compiledMounts: readonly BunHttpMount[] = [];
  let observer: HttpRequestObserver | undefined;
  let server: BunServer | null = null;
  let started = false;
  const emptyParams: Record<string, string> = {};

  const dispatchNative = async (request: Request): Promise<RuntimeHttpResult> => {
    const requestObserver = observer;
    const startedAt = requestObserver ? Date.now() : 0;
    const requestPathname = getPathnameFromUrl(request.url);

    const matchedMount =
      compiledMounts.length > 0 ? matchMount(compiledMounts, requestPathname) : null;

    if (matchedMount) {
      const runtimeRequest = createRuntimeHttpRequestFromWebRequest(request, {
        path: requestPathname,
      });

      try {
        const result = await matchedMount.handle(runtimeRequest);
        await notifyRequestCompletion(requestObserver, {
          request: runtimeRequest,
          result,
          startedAt,
        });
        return result;
      } catch (error) {
        const result = await mapErrorResponse({
          error,
          request: runtimeRequest,
          onError: options.onError,
        });
        await notifyRequestCompletion(requestObserver, {
          request: runtimeRequest,
          result,
          startedAt,
        });
        return result;
      }
    }

    const requestMethod = request.method;
    const exactRoute = exactRoutes.get(createRouteKey(requestMethod, requestPathname));
    const match = exactRoute
      ? {
          route: exactRoute,
          params: emptyParams,
        }
      : matchParamRoute(paramRoutes, requestMethod, requestPathname);

    if (!match) {
      const runtimeRequest = createRuntimeHttpRequestFromWebRequest(request, {
        path: requestPathname,
      });
      const result = jsonErrorResult(
        notFoundError(`Route "${request.method} ${requestPathname}" was not found.`, {
          method: request.method,
          path: requestPathname,
        }),
      );
      await notifyRequestCompletion(requestObserver, {
        request: runtimeRequest,
        result,
        startedAt,
      });
      return result;
    }

    const runtimeRequest = createRuntimeHttpRequestFromWebRequest(request, {
      params: match.params,
      path: requestPathname,
    });

    try {
      const result = await match.route.execute({
        request: runtimeRequest,
      });
      await notifyRequestCompletion(requestObserver, {
        request: runtimeRequest,
        result,
        route: match.route,
        startedAt,
      });
      return result;
    } catch (error) {
      const result = await mapErrorResponse({
        error,
        request: runtimeRequest,
        route: match.route,
        onError: options.onError,
      });
      await notifyRequestCompletion(requestObserver, {
        request: runtimeRequest,
        result,
        route: match.route,
        startedAt,
      });
      return result;
    }
  };

  return {
    basePath: options.basePath,

    registerRoutes(nextRoutes, nextOptions) {
      if (started) {
        throw bedrockError({
          message: "Cannot register routes while the HTTP adapter is running.",
          code: "BEDROCK_HTTP_ADAPTER_RUNNING",
        });
      }

      routes = [...nextRoutes];
      mounts = [...(nextOptions?.mounts ?? [])];
      observer = nextOptions?.observer;
      const nextExactRoutes = new Map<string, BoundHttpRoute>();
      const nextParamRoutes: BunParamRoute[] = [];

      for (const route of routes) {
        const method = route.method.toUpperCase();

        if (route.fullPath.includes(":")) {
          nextParamRoutes.push({
            route,
            method,
            parts: splitPath(route.fullPath),
          });
          continue;
        }

        nextExactRoutes.set(createRouteKey(method, route.fullPath), route);
      }

      exactRoutes = nextExactRoutes;
      paramRoutes = nextParamRoutes;
      compiledMounts = mounts
        .map((mount) => ({
          mount,
          normalizedPath: normalizeMountPath(mount.fullPath),
        }))
        .sort((left, right) => right.normalizedPath.length - left.normalizedPath.length);
    },

    async fetch(request) {
      return runtimeHttpResultToResponse(await dispatchNative(request));
    },

    async start() {
      if (started) {
        return;
      }

      if (options.listen) {
        server = Bun.serve({
          port: options.listen.port,
          hostname: options.listen.hostname,
          fetch: async (request: Request) =>
            runtimeHttpResultToResponse(await dispatchNative(request)),
        });
      }

      started = true;
    },

    async stop() {
      const currentServer = server;
      server = null;
      started = false;

      currentServer?.stop();
    },
  };
}

function createRouteKey(method: string, pathname: string): string {
  return `${method} ${pathname}`;
}

function getPathnameFromUrl(url: string): string {
  const schemeIndex = url.indexOf("://");
  const pathStart = url.indexOf("/", schemeIndex === -1 ? 0 : schemeIndex + 3);

  if (pathStart === -1) {
    return "/";
  }

  const queryIndex = url.indexOf("?", pathStart);
  const hashIndex = url.indexOf("#", pathStart);
  let end = url.length;

  if (queryIndex !== -1) {
    end = queryIndex;
  }

  if (hashIndex !== -1 && hashIndex < end) {
    end = hashIndex;
  }

  return url.slice(pathStart, end) || "/";
}

function matchParamRoute(
  routes: readonly BunParamRoute[],
  method: string,
  pathname: string,
): { route: BoundHttpRoute; params: Record<string, string> } | null {
  const pathnameParts = splitPath(pathname);

  for (const entry of routes) {
    if (entry.method !== method) {
      continue;
    }

    if (entry.parts.length !== pathnameParts.length) {
      continue;
    }

    const params: Record<string, string> = {};
    let matched = true;

    for (const [index, part] of entry.parts.entries()) {
      const pathnamePart = pathnameParts[index];

      if (pathnamePart === undefined) {
        matched = false;
        break;
      }

      if (part.startsWith(":")) {
        params[part.slice(1)] = decodeURIComponent(pathnamePart);
        continue;
      }

      if (part !== pathnamePart) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return {
        route: entry.route,
        params,
      };
    }
  }

  return null;
}

function matchMount(
  mounts: readonly BunHttpMount[],
  pathname: string,
): BoundHttpMount | null {
  for (const entry of mounts) {
    if (
      pathname === entry.normalizedPath ||
      (entry.normalizedPath === "/"
        ? true
        : pathname.startsWith(`${entry.normalizedPath}/`))
    ) {
      return entry.mount;
    }
  }

  return null;
}

function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function normalizeMountPath(path: string): string {
  if (path === "/") {
    return path;
  }

  return path.endsWith("/") ? path.slice(0, -1) : path;
}

async function mapErrorResponse(args: {
  error: unknown;
  request: RuntimeHttpRequest;
  route?: BoundHttpRoute;
  onError?: HttpErrorMapper;
}): Promise<RuntimeHttpResult> {
  if (args.onError) {
    const mapped = await args.onError({
      error: args.error,
      request: args.request,
      route: args.route,
    });

    if (mapped) {
      return mapped;
    }
  }

  return defaultErrorResult(args.error);
}

function defaultErrorResult(error: unknown): RuntimeHttpResult {
  if (isBedrockError(error)) {
    return jsonErrorResult(error);
  }

  return jsonErrorResult(
    bedrockError({
      message: "Internal server error.",
      code: "BEDROCK_HTTP_INTERNAL_ERROR",
      status: 500,
    }),
  );
}

async function notifyRequestCompletion(
  observer: HttpRequestObserver | undefined,
  args: {
    request: RuntimeHttpRequest;
    result: RuntimeHttpResult;
    route?: BoundHttpRoute;
    startedAt: number;
  },
): Promise<void> {
  if (!observer) {
    return;
  }

  const url = new URL(args.request.url);
  const entry: HttpRequestLogEntry = {
    method: args.request.method,
    pathname: url.pathname,
    status: args.result.status,
    durationMs: Math.max(Date.now() - args.startedAt, 0),
    matched: args.route !== undefined,
    moduleName: args.route?.moduleName,
    controllerName: args.route?.controllerName,
    routeName: args.route?.routeName,
    routePath: args.route?.path,
    fullPath: args.route?.fullPath,
    query: args.request.query,
    headers: args.request.headers,
  };

  await observer.onComplete(entry);
}

function jsonErrorResult(error: {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}): RuntimeHttpResult {
  return {
    kind: "json",
    status: error.status ?? 500,
    body: JSON.stringify({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    }),
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  };
}
