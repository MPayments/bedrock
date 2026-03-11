import { Readable } from "node:stream";

import {
  bedrockError,
  isBedrockError,
  notFoundError,
  validationError,
} from "@bedrock/common";
import {
  createRuntimeHttpRequestFromWebRequest,
  parseRequestCookies,
  runtimeHttpResultToResponse,
  type BoundHttpMount,
  type BoundHttpRoute,
  type HttpAdapter,
  type HttpCookieMutation,
  type HttpErrorMapper,
  type HttpRequestBodyDescriptor,
  type HttpRequestLogEntry,
  type HttpRequestObserver,
  type RuntimeHttpRequest,
  type RuntimeHttpResult,
} from "@bedrock/core";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type HTTPMethods,
} from "fastify";

type RuntimeFormData = Awaited<ReturnType<Request["formData"]>>;
type RuntimeFormDataEntryValue = Awaited<ReturnType<RuntimeFormData["get"]>>;
type RuntimeHttpBodyReader = (
  descriptor: HttpRequestBodyDescriptor<any, any> | undefined,
) => Promise<unknown>;
type RuntimeHttpRawBody = string | Uint8Array | ReadableStream<Uint8Array> | null;

type FastifyParamRoute = {
  route: BoundHttpRoute;
  method: string;
  parts: readonly string[];
};

type FastifyHttpMount = {
  mount: BoundHttpMount;
  normalizedPath: string;
};

export type FastifyHttpAdapterOptions = {
  basePath?: string;
  listen?: false | {
    port?: number;
    host?: string;
  };
  cors?:
    | false
    | {
        origins: readonly string[];
        allowHeaders?: readonly string[];
        allowMethods?: readonly string[];
        exposeHeaders?: readonly string[];
        credentials?: boolean;
      };
  csrf?:
    | false
    | {
        trustedOrigins: readonly string[];
      };
  onError?: HttpErrorMapper;
};

export function createFastifyHttpAdapter(
  options: FastifyHttpAdapterOptions = {},
): HttpAdapter {
  let routes: readonly BoundHttpRoute[] = [];
  let exactRoutes = new Map<string, BoundHttpRoute>();
  let paramRoutes: readonly FastifyParamRoute[] = [];
  let mounts: readonly BoundHttpMount[] = [];
  let compiledMounts: readonly FastifyHttpMount[] = [];
  let observer: HttpRequestObserver | undefined;
  let app: FastifyInstance | null = null;
  let started = false;
  const emptyParams: Record<string, string> = {};

  const dispatchWebRequest = async (request: Request): Promise<Response> =>
    runtimeHttpResultToResponse(await dispatchNativeRequest(request));

  const dispatchNativeRequest = async (request: Request): Promise<RuntimeHttpResult> => {
    const requestObserver = observer;
    const startedAt = requestObserver ? Date.now() : 0;
    const baseRuntimeRequest = createRuntimeHttpRequestFromWebRequest(request);
    const earlyPolicyResult = resolveEarlyPolicyResult(baseRuntimeRequest, options);

    if (earlyPolicyResult) {
      const result = applyResponsePolicies(earlyPolicyResult, baseRuntimeRequest, options);
      await notifyRequestCompletion(requestObserver, {
        request: baseRuntimeRequest,
        result,
        startedAt,
      });
      return result;
    }

    let url: URL | undefined;
    const pathname = () => {
      url ??= new URL(request.url);
      return url.pathname;
    };
    const matchedMount =
      compiledMounts.length > 0 ? matchMount(compiledMounts, pathname()) : null;

    if (matchedMount) {
      const runtimeRequest = baseRuntimeRequest;

      try {
        const result = applyResponsePolicies(
          await matchedMount.handle(runtimeRequest),
          runtimeRequest,
          options,
        );
        await notifyRequestCompletion(requestObserver, {
          request: runtimeRequest,
          result,
          startedAt,
        });
        return result;
      } catch (error) {
        const result = applyResponsePolicies(
          await mapErrorResponse({
            error,
            request: runtimeRequest,
            onError: options.onError,
          }),
          runtimeRequest,
          options,
        );
        await notifyRequestCompletion(requestObserver, {
          request: runtimeRequest,
          result,
          startedAt,
        });
        return result;
      }
    }

    const method = request.method.toUpperCase();
    const requestPathname = pathname();
    const exactRoute = exactRoutes.get(createRouteKey(method, requestPathname));
    const match = exactRoute
      ? {
          route: exactRoute,
          params: emptyParams,
        }
      : matchParamRoute(paramRoutes, method, requestPathname);

    if (!match) {
      const result = applyResponsePolicies(
        jsonErrorResult(
          notFoundError(`Route "${request.method} ${requestPathname}" was not found.`, {
            method: request.method,
            path: requestPathname,
          }),
        ),
        baseRuntimeRequest,
        options,
      );
      await notifyRequestCompletion(requestObserver, {
        request: baseRuntimeRequest,
        result,
        startedAt,
      });
      return result;
    }

    const runtimeRequest = createRuntimeHttpRequestFromWebRequest(request, {
      params: match.params,
    });

    try {
      const result = applyResponsePolicies(
        await match.route.execute({
          request: runtimeRequest,
        }),
        runtimeRequest,
        options,
      );
      await notifyRequestCompletion(requestObserver, {
        request: runtimeRequest,
        result,
        route: match.route,
        startedAt,
      });
      return result;
    } catch (error) {
      const result = applyResponsePolicies(
        await mapErrorResponse({
          error,
          request: runtimeRequest,
          route: match.route,
          onError: options.onError,
        }),
        runtimeRequest,
        options,
      );
      await notifyRequestCompletion(requestObserver, {
        request: runtimeRequest,
        result,
        route: match.route,
        startedAt,
      });
      return result;
    }
  };

  const ensureApp = (): FastifyInstance => {
    if (app) {
      return app;
    }

    const next = Fastify();

    next.addHook("onRequest", async (request, reply) => {
      if (observer) {
        (request as FastifyRequest & {
          bedrockRequestStartedAt?: number;
        }).bedrockRequestStartedAt = Date.now();
      }

      const runtimeRequest = createFastifyRuntimeRequest(request);
      const earlyPolicyResult = resolveEarlyPolicyResult(runtimeRequest, options);

      if (!earlyPolicyResult) {
        return;
      }

      const result = applyResponsePolicies(earlyPolicyResult, runtimeRequest, options);
      await notifyRequestCompletion(observer, {
        request: runtimeRequest,
        result,
        startedAt: observer ? readRequestStartedAt(request) : 0,
      });
      return sendFastifyResponse(reply, result);
    });

    next.removeAllContentTypeParsers();
    next.addContentTypeParser(
      "*",
      { parseAs: "buffer" },
      (_request, body, done) => done(null, body),
    );

    for (const mount of mounts) {
      for (const pattern of getMountPatterns(mount.fullPath)) {
        next.all(pattern, async (request, reply) => {
          const runtimeRequest = createFastifyRuntimeRequest(request);
          const startedAt = observer ? readRequestStartedAt(request) : 0;

          try {
            const result = applyResponsePolicies(
              await mount.handle(runtimeRequest),
              runtimeRequest,
              options,
            );
            await notifyRequestCompletion(observer, {
              request: runtimeRequest,
              result,
              startedAt,
            });
            return sendFastifyResponse(reply, result);
          } catch (error) {
            const result = applyResponsePolicies(
              await mapErrorResponse({
                error,
                request: runtimeRequest,
                onError: options.onError,
              }),
              runtimeRequest,
              options,
            );
            await notifyRequestCompletion(observer, {
              request: runtimeRequest,
              result,
              startedAt,
            });
            return sendFastifyResponse(reply, result);
          }
        });
      }
    }

    for (const route of routes) {
      next.route({
        method: route.method as HTTPMethods,
        url: route.fullPath,
        handler: async (request, reply) => {
          const runtimeRequest = createFastifyRuntimeRequest(request);
          const startedAt = observer ? readRequestStartedAt(request) : 0;

          try {
            const result = applyResponsePolicies(
              await route.execute({
                request: runtimeRequest,
              }),
              runtimeRequest,
              options,
            );
            await notifyRequestCompletion(observer, {
              request: runtimeRequest,
              result,
              route,
              startedAt,
            });
            return sendFastifyResponse(reply, result);
          } catch (error) {
            const result = applyResponsePolicies(
              await mapErrorResponse({
                error,
                request: runtimeRequest,
                route,
                onError: options.onError,
              }),
              runtimeRequest,
              options,
            );
            await notifyRequestCompletion(observer, {
              request: runtimeRequest,
              result,
              route,
              startedAt,
            });
            return sendFastifyResponse(reply, result);
          }
        },
      });
    }

    next.setNotFoundHandler(async (request, reply) => {
      const runtimeRequest = createFastifyRuntimeRequest(request);
      const result = applyResponsePolicies(
        jsonErrorResult(
          notFoundError(`Route "${request.method} ${getPathname(request)}" was not found.`, {
            method: request.method,
            path: getPathname(request),
          }),
        ),
        runtimeRequest,
        options,
      );
      await notifyRequestCompletion(observer, {
        request: runtimeRequest,
        result,
        startedAt: observer ? readRequestStartedAt(request) : 0,
      });
      return sendFastifyResponse(reply, result);
    });

    app = next;
    return next;
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
      const nextParamRoutes: FastifyParamRoute[] = [];

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
      app = null;
    },

    async fetch(request) {
      return dispatchWebRequest(request);
    },

    async start() {
      if (started) {
        return;
      }

      const currentApp = ensureApp();
      if (options.listen) {
        await currentApp.listen({
          port: options.listen.port,
          host: options.listen.host,
        });
      }

      started = true;
    },

    async stop() {
      const currentApp = app;
      app = null;
      started = false;

      if (currentApp) {
        await currentApp.close();
      }
    },
  };
}

function createRouteKey(method: string, pathname: string): string {
  return `${method} ${pathname}`;
}

function matchParamRoute(
  routes: readonly FastifyParamRoute[],
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
  mounts: readonly FastifyHttpMount[],
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

function getMountPatterns(fullPath: string): string[] {
  if (fullPath === "/") {
    return ["/", "/*"];
  }

  const normalized = fullPath.endsWith("/") && fullPath !== "/"
    ? fullPath.slice(0, -1)
    : fullPath;

  return [normalized, `${normalized}/*`];
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

function createFastifyRuntimeRequest(request: FastifyRequest): RuntimeHttpRequest {
  const rawUrl = request.url;
  const pathname = getPathnameFromUrl(rawUrl);
  let url: string | undefined;
  let searchParams: URLSearchParams | undefined;
  let params: Record<string, string> | undefined;
  let query: Record<string, string | string[]> | undefined;
  let headers: Record<string, string> | undefined;
  let cookies: Record<string, string> | undefined;
  let bodyReader: RuntimeHttpBodyReader | undefined;
  const readUrl = () => (url ??= getRequestUrl(request));

  return {
    method: request.method,
    get url() {
      return readUrl();
    },
    path: pathname,
    get params() {
      return (params ??= buildParamValues(request.params));
    },
    get query() {
      return (query ??= buildQueryValues(
        (searchParams ??= new URLSearchParams(getSearchFromUrl(rawUrl))),
      ));
    },
    get headers() {
      return (headers ??= buildHeaderValues(request.headers));
    },
    get cookies() {
      return (cookies ??= parseRequestCookies(readHeaderValue(request.headers, "cookie")));
    },
    get readBody() {
      return (bodyReader ??= createFastifyBodyReader(request, readUrl));
    },
    raw: request,
  };
}

function createFastifyBodyReader(
  request: FastifyRequest,
  readUrl: () => string,
): RuntimeHttpBodyReader {
  const cache = new Map<string, Promise<unknown>>();

  return (descriptor) => {
    const key = descriptor?.kind ?? "json";
    const cached = cache.get(key);

    if (cached) {
      return cached;
    }

    const pending = readFastifyRequestBody(request, readUrl(), descriptor);
    cache.set(key, pending);
    return pending;
  };
}

async function readFastifyRequestBody(
  request: FastifyRequest,
  url: string,
  descriptor: HttpRequestBodyDescriptor<any, any> | undefined,
): Promise<unknown> {
  if (!descriptor) {
    return undefined;
  }

  switch (descriptor.kind) {
    case "json":
      return readJsonBody(request);
    case "text":
      return readTextBody(request);
    case "binary":
      return readBinaryBody(request);
    case "formData":
      return readFormDataBody(request, url, "multipart/form-data");
    case "urlEncoded":
      return readFormDataBody(request, url, "application/x-www-form-urlencoded");
  }
}

async function readJsonBody(request: FastifyRequest): Promise<unknown> {
  const bodyText = readBodyText(request.body);

  if (bodyText === undefined || bodyText.length === 0) {
    return undefined;
  }

  if (!matchesJsonContentType(readHeaderValue(request.headers, "content-type") ?? null)) {
    throw unsupportedMediaType(readHeaderValue(request.headers, "content-type") ?? null);
  }

  try {
    return JSON.parse(bodyText);
  } catch (error) {
    throw validationError("Invalid JSON request body.", {
      cause: error,
    });
  }
}

function readTextBody(request: FastifyRequest): string | undefined {
  const bodyText = readBodyText(request.body);

  if (bodyText === undefined || bodyText.length === 0) {
    return undefined;
  }

  if (!matchesContentType(readHeaderValue(request.headers, "content-type") ?? null, "text/plain")) {
    throw unsupportedMediaType(readHeaderValue(request.headers, "content-type") ?? null);
  }

  return bodyText;
}

function readBinaryBody(request: FastifyRequest): Uint8Array | undefined {
  const bytes = getRequestBodyBytes(request.body);

  if (!bytes || bytes.byteLength === 0) {
    return undefined;
  }

  if (
    !matchesContentType(
      readHeaderValue(request.headers, "content-type") ?? null,
      "application/octet-stream",
    )
  ) {
    throw unsupportedMediaType(readHeaderValue(request.headers, "content-type") ?? null);
  }

  return bytes;
}

async function readFormDataBody(
  request: FastifyRequest,
  url: string,
  expectedContentType: "multipart/form-data" | "application/x-www-form-urlencoded",
): Promise<unknown> {
  const bytes = getRequestBodyBytes(request.body);

  if (!bytes || bytes.byteLength === 0) {
    return {};
  }

  const contentType = readHeaderValue(request.headers, "content-type") ?? null;

  if (!matchesContentType(contentType, expectedContentType)) {
    throw unsupportedMediaType(contentType);
  }

  const webRequest = new Request(url, {
    method: request.method,
    headers: createHeaders(request.headers),
    body: bytes,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const formData = await webRequest.formData();
  const result: Record<
    string,
    RuntimeFormDataEntryValue | RuntimeFormDataEntryValue[]
  > = {};

  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key);
    result[key] = values.length > 1 ? values : (values[0] ?? "");
  }

  return result;
}

function readBodyText(body: unknown): string | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === "string") {
    return body;
  }

  const bytes = getRequestBodyBytes(body);

  if (!bytes) {
    return undefined;
  }

  return new TextDecoder().decode(bytes);
}

function buildParamValues(params: unknown): Record<string, string> {
  const values: Record<string, string> = {};

  if (!params || typeof params !== "object") {
    return values;
  }

  for (const [key, value] of Object.entries(params)) {
    values[key] = String(value);
  }

  return values;
}

function getRequestBodyBytes(body: unknown): Uint8Array | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (body instanceof Uint8Array) {
    return body;
  }

  if (Buffer.isBuffer(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }

  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }

  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }

  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }

  return undefined;
}

function createHeaders(headers: FastifyRequest["headers"]): Headers {
  const values = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        values.append(key, entry);
      }

      continue;
    }

    values.set(key, String(value));
  }

  return values;
}

function buildHeaderValues(headers: FastifyRequest["headers"]): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    values[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
  }

  return values;
}

function buildQueryValues(searchParams: URLSearchParams): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};

  for (const key of new Set(searchParams.keys())) {
    const entries = searchParams.getAll(key);
    values[key] = entries.length > 1 ? entries : (entries[0] ?? "");
  }

  return values;
}

function readHeaderValue(
  headers: FastifyRequest["headers"],
  key: string,
): string | undefined {
  const value = headers[key];

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return typeof value === "string" ? value : undefined;
}

function readRequestStartedAt(request: FastifyRequest): number {
  const value = (
    request as FastifyRequest & {
      bedrockRequestStartedAt?: number;
    }
  ).bedrockRequestStartedAt;

  return typeof value === "number" ? value : Date.now();
}

function getRequestUrl(request: FastifyRequest): string {
  const host = readHeaderValue(request.headers, "host") ?? "fastify.local";
  return new URL(request.url, `http://${host}`).toString();
}

function getPathname(request: FastifyRequest): string {
  return getPathnameFromUrl(request.url);
}

function getPathnameFromUrl(url: string): string {
  const queryIndex = url.indexOf("?");
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

function getSearchFromUrl(url: string): string {
  const queryIndex = url.indexOf("?");

  return queryIndex === -1 ? "" : url.slice(queryIndex + 1);
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

function resolveEarlyPolicyResult(
  request: RuntimeHttpRequest,
  options: Pick<FastifyHttpAdapterOptions, "cors" | "csrf">,
): RuntimeHttpResult | null {
  const preflight = createCorsPreflightResult(request, options.cors);
  if (preflight) {
    return preflight;
  }

  return createCsrfRejectionResult(request, options.csrf);
}

function createCorsPreflightResult(
  request: RuntimeHttpRequest,
  cors: FastifyHttpAdapterOptions["cors"],
): RuntimeHttpResult | null {
  if (!cors || request.method.toUpperCase() !== "OPTIONS") {
    return null;
  }

  const accessControlRequestMethod =
    readRuntimeHeader(request, "access-control-request-method");
  if (!accessControlRequestMethod) {
    return null;
  }

  const origin = readRuntimeHeader(request, "origin");
  if (!origin || !isAllowedOrigin(origin, cors.origins)) {
    return jsonErrorResult(
      bedrockError({
        message: "Origin is not allowed.",
        code: "BEDROCK_HTTP_CORS_ORIGIN_FORBIDDEN",
        status: 403,
        details: {
          origin,
        },
      }),
    );
  }

  return {
    kind: "empty",
    status: 204,
    headers: {},
  };
}

function createCsrfRejectionResult(
  request: RuntimeHttpRequest,
  csrf: FastifyHttpAdapterOptions["csrf"],
): RuntimeHttpResult | null {
  if (!csrf || isSafeMethod(request.method)) {
    return null;
  }

  const requestOrigin = readTrustedRequestOrigin(request);
  if (!requestOrigin || isAllowedOrigin(requestOrigin, csrf.trustedOrigins)) {
    return null;
  }

  return jsonErrorResult(
    bedrockError({
      message: "Cross-site request blocked.",
      code: "BEDROCK_HTTP_CSRF_FORBIDDEN",
      status: 403,
      details: {
        origin: requestOrigin,
      },
    }),
  );
}

function applyResponsePolicies(
  result: RuntimeHttpResult,
  request: RuntimeHttpRequest,
  options: Pick<FastifyHttpAdapterOptions, "cors">,
): RuntimeHttpResult {
  const corsHeaders = createCorsResponseHeaders(request, options.cors);
  if (!corsHeaders) {
    return result;
  }
  const { vary, ...restCorsHeaders } = corsHeaders;

  return {
    ...result,
    headers: {
      ...(result.headers ?? {}),
      ...(vary
        ? {
            vary: appendVaryHeader(
              readHeaderRecordValue(result.headers, "vary"),
              vary,
            ),
          }
        : {}),
      ...restCorsHeaders,
    },
  };
}

function createCorsResponseHeaders(
  request: RuntimeHttpRequest,
  cors: FastifyHttpAdapterOptions["cors"],
): Record<string, string> | null {
  if (!cors) {
    return null;
  }

  const origin = readRuntimeHeader(request, "origin");
  if (!origin || !isAllowedOrigin(origin, cors.origins)) {
    return null;
  }

  const headers: Record<string, string> = {
    "access-control-allow-origin": origin,
    vary: appendVaryHeader(undefined, "Origin"),
  };

  if (cors.credentials) {
    headers["access-control-allow-credentials"] = "true";
  }

  if (request.method.toUpperCase() === "OPTIONS") {
    headers["access-control-allow-methods"] = (
      cors.allowMethods ?? [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ]
    ).join(", ");

    const requestedHeaders = readRuntimeHeader(request, "access-control-request-headers");
    const allowHeaders =
      cors.allowHeaders ??
      (requestedHeaders
        ? requestedHeaders
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : []);
    if (allowHeaders.length > 0) {
      headers["access-control-allow-headers"] = allowHeaders.join(", ");
    }
  } else if (cors.exposeHeaders && cors.exposeHeaders.length > 0) {
    headers["access-control-expose-headers"] = cors.exposeHeaders.join(", ");
  }

  return headers;
}

function readTrustedRequestOrigin(request: RuntimeHttpRequest): string | null {
  const origin = readRuntimeHeader(request, "origin");
  if (origin) {
    return origin;
  }

  const referer = readRuntimeHeader(request, "referer");
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function readRuntimeHeader(request: RuntimeHttpRequest, name: string): string | null {
  const value = request.headers[name.toLowerCase()];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isAllowedOrigin(
  origin: string,
  allowedOrigins: readonly string[],
): boolean {
  return allowedOrigins.includes(origin);
}

function isSafeMethod(method: string): boolean {
  const normalized = method.toUpperCase();
  return normalized === "GET" || normalized === "HEAD" || normalized === "OPTIONS";
}

function appendVaryHeader(
  current: string | undefined,
  value: string,
): string {
  if (!current || current.length === 0) {
    return value;
  }

  const values = new Set(
    current
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
  values.add(value);
  return [...values].join(", ");
}

function readHeaderRecordValue(
  headers: RuntimeHttpResult["headers"] | undefined,
  name: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const value = headers[name];
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return typeof value === "string" ? value : undefined;
}

async function sendFastifyResponse(
  reply: FastifyReply,
  result: RuntimeHttpResult,
): Promise<FastifyReply> {
  reply.code(result.status);
  applyHeaders(reply, result);

  switch (result.kind) {
    case "json":
    case "text":
      return reply.send(result.body);
    case "binary":
      return reply.send(Buffer.from(result.body));
    case "empty":
      return reply.send();
    case "redirect":
      return reply.send();
    case "raw":
      return sendRawBody(reply, result.body);
    case "sse":
      return reply.send(createNodeSseStream(result.source));
  }

  throw new Error(`Unsupported runtime HTTP result kind: ${(result as { kind: string }).kind}`);
}

function applyHeaders(reply: FastifyReply, result: RuntimeHttpResult): void {
  if (result.kind === "redirect") {
    reply.header("location", result.location);
  }

  if (result.kind === "raw" && result.contentType) {
    reply.header("content-type", result.contentType);
  }

  for (const [key, value] of Object.entries(result.headers ?? {})) {
    if (key.toLowerCase() === "set-cookie") {
      continue;
    }

    reply.header(key, Array.isArray(value) ? [...value] : value);
  }

  const setCookieHeaders = serializeCookies(result.cookies);

  if (setCookieHeaders.length > 0) {
    reply.header("set-cookie", setCookieHeaders);
  }
}

function serializeCookies(
  cookies: readonly HttpCookieMutation[] | undefined,
): string[] {
  if (!cookies || cookies.length === 0) {
    return [];
  }

  return cookies.map((cookie) => {
    if (cookie.kind === "set" && cookie.name === "set-cookie" && !cookie.options) {
      return cookie.value;
    }

    return cookie.kind === "set"
      ? serializeCookie(cookie.name, cookie.value, cookie.options)
      : serializeCookie(cookie.name, "", {
          ...cookie.options,
          expires: new Date(0),
          maxAge: 0,
        });
  });
}

async function sendRawBody(
  reply: FastifyReply,
  body: RuntimeHttpRawBody,
): Promise<FastifyReply> {
  if (body === null) {
    return reply.send();
  }

  if (typeof body === "string") {
    return reply.send(body);
  }

  if (body instanceof Uint8Array) {
    return reply.send(Buffer.from(body));
  }

  return reply.send(Readable.fromWeb(body as never));
}

function createNodeSseStream(
  source: AsyncIterable<unknown> | Iterable<unknown>,
): Readable {
  const encoder = new TextEncoder();

  async function* chunks(): AsyncIterable<Uint8Array> {
    for await (const value of source) {
      yield encoder.encode(serializeSseEvent(value));
    }
  }

  return Readable.from(chunks());
}

function serializeSseEvent(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "comment" in value &&
    typeof (value as { comment?: unknown }).comment === "string"
  ) {
    return `: ${(value as { comment: string }).comment}\n\n`;
  }

  if (typeof value !== "object" || value === null || !("data" in value)) {
    throw bedrockError({
      message: "Invalid SSE event.",
      code: "BEDROCK_HTTP_ROUTE_CONTRACT_ERROR",
      status: 500,
    });
  }

  const event = value as {
    data: unknown;
    id?: string;
    event?: string;
    retry?: number;
  };
  const lines: string[] = [];

  if (event.id !== undefined) {
    lines.push(`id: ${event.id}`);
  }
  if (event.event !== undefined) {
    lines.push(`event: ${event.event}`);
  }
  if (event.retry !== undefined) {
    lines.push(`retry: ${event.retry}`);
  }

  const serializedData = JSON.stringify(event.data);

  for (const line of serializedData.split("\n")) {
    lines.push(`data: ${line}`);
  }

  return `${lines.join("\n")}\n\n`;
}

function matchesJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }

  const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  return normalized === "application/json" || normalized.endsWith("+json");
}

function matchesContentType(
  contentType: string | null,
  expected: string,
): boolean {
  if (!contentType) {
    return false;
  }

  return (contentType.toLowerCase().split(";")[0]?.trim() ?? "") === expected;
}

function unsupportedMediaType(contentType: string | null) {
  return bedrockError({
    message: "Unsupported media type.",
    code: "BEDROCK_HTTP_UNSUPPORTED_MEDIA_TYPE",
    status: 415,
    details: {
      contentType,
    },
  });
}

function serializeCookie(
  name: string,
  value: string,
  options:
    | {
        domain?: string;
        expires?: Date;
        httpOnly?: boolean;
        maxAge?: number;
        path?: string;
        sameSite?: "lax" | "strict" | "none";
        secure?: boolean;
      }
    | undefined,
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options?.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (options?.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options?.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (options?.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.trunc(options.maxAge)}`);
  }
  if (options?.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options?.secure) {
    parts.push("Secure");
  }
  if (options?.sameSite) {
    parts.push(`SameSite=${capitalize(options.sameSite)}`);
  }

  return parts.join("; ");
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}
