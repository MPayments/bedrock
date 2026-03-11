import type {
  ApiClient,
  InferErrorResponseType,
  InferParsedResponseType,
} from "./types";

type RequestHeadersInit = ConstructorParameters<typeof Headers>[0];
type RequestInitOverride = Omit<RequestInit, "body" | "headers" | "method">;
type RuntimeBodyInit = Exclude<ConstructorParameters<typeof Request>[1], undefined> extends infer TInit
  ? TInit extends { body?: infer TBody }
    ? Exclude<TBody, undefined>
    : never
  : never;

export type ApiClientConfig = {
  baseUrl: string | URL;
  fetch?: typeof fetch;
  init?: RequestInitOverride;
  headers?:
    | RequestHeadersInit
    | (() => RequestHeadersInit | Promise<RequestHeadersInit>);
  buildSearchParams?: (
    query: Record<string, QueryValue>,
  ) => URLSearchParams;
};

type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly QueryValue[];

type RequestOptions = {
  param?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, QueryValue>;
  headers?: RequestHeadersInit;
  cookies?: Record<string, unknown>;
  json?: unknown;
  formData?: unknown;
  form?: unknown;
  text?: unknown;
  binary?: unknown;
  init?: RequestInitOverride;
};

type RequestOverrides = {
  headers?: RequestHeadersInit;
  init?: RequestInitOverride;
};

const METHOD_NAMES = new Set(["$get", "$post", "$put", "$patch", "$delete"]);
const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

export function createApiClient<TContract>(
  config: ApiClientConfig,
): ApiClient<TContract> {
  return createPathProxy(config, []) as ApiClient<TContract>;
}

function createPathProxy(
  config: ApiClientConfig,
  segments: readonly string[],
): unknown {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return undefined;
        }

        if (property === "$url") {
          return (options?: RequestOptions) => buildUrl(config, segments, options);
        }

        if (property === "$path") {
          return (options?: RequestOptions) => buildPath(config, segments, options);
        }

        if (typeof property === "string" && METHOD_NAMES.has(property)) {
          const method = property.slice(1).toUpperCase();
          return async (options?: RequestOptions, overrides?: RequestOverrides) =>
            executeRequest(config, method, segments, options, overrides);
        }

        if (typeof property !== "string") {
          return undefined;
        }

        return createPathProxy(config, [...segments, property]);
      },
    },
  );
}

async function executeRequest(
  config: ApiClientConfig,
  method: string,
  segments: readonly string[],
  options: RequestOptions | undefined,
  overrides: RequestOverrides | undefined,
): Promise<Response> {
  const fetchImpl = config.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error(
      "No fetch implementation is available. Provide ApiClientConfig.fetch or use a runtime with global fetch().",
    );
  }

  const url = buildRequestUrl(config, segments, options);
  const { body, contentType } = buildRequestBody(options);
  const headers = await resolveHeaders(
    config.headers,
    options?.headers,
    overrides?.headers,
    options?.cookies,
    contentType,
  );
  const init: RequestInit = {
    ...(config.init ?? {}),
    ...(options?.init ?? {}),
    ...(overrides?.init ?? {}),
    method,
    headers,
    redirect:
      overrides?.init?.redirect ??
      options?.init?.redirect ??
      config.init?.redirect ??
      "manual",
  };

  if (body !== undefined) {
    init.body = body;
  }

  return fetchImpl(url, init);
}

export class DetailedError<
  TResponse extends Response = Response,
  TBody = unknown,
> extends Error {
  override readonly name = "DetailedError";
  readonly status: TResponse["status"];
  readonly response: TResponse;
  readonly body: TBody;

  constructor(
    response: TResponse,
    body: TBody,
    message: string = buildDetailedErrorMessage(response, body),
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.status = response.status;
    this.response = response;
    this.body = body;
  }
}

export async function parseResponse<TResponse extends Response>(
  responseOrPromise: TResponse | Promise<TResponse>,
): Promise<InferParsedResponseType<TResponse>> {
  const response = await responseOrPromise;
  const body = await parseBody(response);

  if (!response.ok) {
    throw new DetailedError<TResponse, InferErrorResponseType<TResponse>>(
      response,
      body as InferErrorResponseType<TResponse>,
    );
  }

  return body as InferParsedResponseType<TResponse>;
}

function buildUrl(
  config: Pick<ApiClientConfig, "baseUrl" | "buildSearchParams">,
  segments: readonly string[],
  options?: Pick<RequestOptions, "param" | "params" | "query">,
): URL {
  if (!isAbsoluteBaseUrl(config.baseUrl)) {
    throw new Error(
      'ApiClientConfig.baseUrl must be an absolute URL to use $url(). Use $path() for relative base URLs.',
    );
  }

  const absoluteBase = getAbsoluteBaseUrl(config.baseUrl);
  const path = buildPathnameAndSearch(config, segments, options);

  return new URL(path, absoluteBase.origin);
}

function buildPath(
  config: ApiClientConfig,
  segments: readonly string[],
  options?: Pick<RequestOptions, "param" | "params" | "query">,
): string {
  return buildPathnameAndSearch(config, segments, options);
}

function buildRequestUrl(
  config: ApiClientConfig,
  segments: readonly string[],
  options?: Pick<RequestOptions, "param" | "params" | "query">,
): string {
  const path = buildPathnameAndSearch(config, segments, options);

  if (!isAbsoluteBaseUrl(config.baseUrl)) {
    return path;
  }

  return `${getAbsoluteBaseUrl(config.baseUrl).origin}${path}`;
}

function buildPathnameAndSearch(
  config: Pick<ApiClientConfig, "baseUrl" | "buildSearchParams">,
  segments: readonly string[],
  options?: Pick<RequestOptions, "param" | "params" | "query">,
): string {
  const basePath = getBasePathname(config.baseUrl);
  const resolvedSegments = segments.map((segment) =>
    resolvePathSegment(segment, options),
  );
  const pathnameParts = basePath ? [basePath, ...resolvedSegments] : resolvedSegments;
  const pathname = pathnameParts.length === 0 ? "/" : `/${pathnameParts.join("/")}`;
  const searchParams = buildSearchParams(config, options?.query);
  const search = searchParams.toString();

  return search.length > 0 ? `${pathname}?${search}` : pathname;
}

function resolvePathSegment(
  segment: string,
  options: Pick<RequestOptions, "param" | "params"> | undefined,
): string {
  if (segment.startsWith(":")) {
    const paramName = segment.slice(1);
    const params = options?.params ?? options?.param;
    const value = params?.[paramName];

    if (value === undefined) {
      throw new Error(`Missing path parameter "${paramName}".`);
    }

    return encodeURIComponent(String(value));
  }

  if (segment.startsWith("$$")) {
    return `$${segment.slice(2)}`;
  }

  return segment;
}

function normalizeBasePath(pathname: string): string | undefined {
  if (pathname === "/" || pathname.length === 0) {
    return undefined;
  }

  return pathname.replace(/^\/+/, "").replace(/\/+$/, "");
}

function buildSearchParams(
  config: Pick<ApiClientConfig, "buildSearchParams">,
  query: Record<string, QueryValue> | undefined,
): URLSearchParams {
  if (!query) {
    return new URLSearchParams();
  }

  if (config.buildSearchParams) {
    return config.buildSearchParams(query);
  }

  const searchParams = new URLSearchParams();

  appendQuery(searchParams, query);
  return searchParams;
}

function appendQuery(
  searchParams: URLSearchParams,
  query: Record<string, QueryValue>,
): void {
  if (!query) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(searchParams, key, value);
  }
}

function appendQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: QueryValue,
): void {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      appendQueryValue(searchParams, key, entry);
    }

    return;
  }

  if (typeof value === "object" && value !== null) {
    throw new Error(
      `Query parameter "${key}" must be a primitive or array of primitives.`,
    );
  }

  searchParams.append(key, String(value));
}

function buildRequestBody(options: RequestOptions | undefined): {
  body?: RuntimeBodyInit;
  contentType?: string;
} {
  if (!options) {
    return {};
  }

  const bodyKeys = [
    "json",
    "formData",
    "form",
    "text",
    "binary",
  ].filter((key) => Object.prototype.hasOwnProperty.call(options, key));

  if (bodyKeys.length > 1) {
    throw new Error("Only one request body option may be used at a time.");
  }

  if (options.json !== undefined) {
    return {
      body: JSON.stringify(options.json) as RuntimeBodyInit,
      contentType: "application/json; charset=utf-8",
    };
  }

  if (options.formData !== undefined) {
    return {
      body: toFormData(options.formData),
    };
  }

  if (options.form !== undefined) {
    return {
      body: toUrlEncodedBody(options.form),
      contentType: "application/x-www-form-urlencoded; charset=utf-8",
    };
  }

  if (options.text !== undefined) {
    return {
      body: String(options.text) as RuntimeBodyInit,
      contentType: "text/plain; charset=utf-8",
    };
  }

  if (options.binary !== undefined) {
    return {
      body: toBinaryBody(options.binary),
      contentType: "application/octet-stream",
    };
  }

  return {};
}

async function resolveHeaders(
  clientHeaders: ApiClientConfig["headers"],
  requestHeaders: RequestHeadersInit | undefined,
  overrideHeaders: RequestHeadersInit | undefined,
  cookies: Record<string, unknown> | undefined,
  contentType: string | undefined,
): Promise<Headers> {
  const resolvedClientHeaders =
    typeof clientHeaders === "function" ? await clientHeaders() : clientHeaders;
  const headers = new Headers();

  appendHeaders(headers, resolvedClientHeaders);

  if (requestHeaders) {
    appendHeaders(headers, requestHeaders);
  }

  if (overrideHeaders) {
    appendHeaders(headers, overrideHeaders);
  }

  if (cookies && Object.keys(cookies).length > 0) {
    headers.set("cookie", serializeCookies(cookies));
  }

  if (contentType && !headers.has("content-type")) {
    headers.set("content-type", contentType);
  }

  return headers;
}

function appendHeaders(
  target: Headers,
  source: RequestHeadersInit | undefined,
): void {
  if (!source) {
    return;
  }

  if (source instanceof Headers) {
    for (const [key, value] of source.entries()) {
      target.set(key, value);
    }

    return;
  }

  if (Array.isArray(source)) {
    for (const [key, value] of source) {
      if (key !== undefined && value !== undefined) {
        target.set(key, String(value));
      }
    }

    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      target.set(key, String(value));
    }
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase();

  if (contentType?.includes("text/event-stream")) {
    throw new Error(
      "parseResponse() does not support Server-Sent Events responses. Use the raw Response instead.",
    );
  }

  if (
    response.status === 204 ||
    response.status === 205 ||
    response.status === 304 ||
    (response.status >= 300 && response.status <= 399)
  ) {
    return response;
  }

  if (contentType?.includes("application/json") || contentType?.includes("+json")) {
    const text = await response.text();
    return text.length === 0 ? null : JSON.parse(text);
  }

  if (contentType?.startsWith("text/")) {
    return response.text();
  }

  if (contentType?.includes("application/octet-stream")) {
    return new Uint8Array(await response.arrayBuffer());
  }

  if (
    contentType?.includes("multipart/form-data") ||
    contentType?.includes("application/x-www-form-urlencoded")
  ) {
    return response.formData();
  }

  if (!contentType) {
    return response;
  }

  return response;
}

function buildDetailedErrorMessage(
  response: Response,
  body: unknown,
): string {
  const bodyMessage =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
      ? body.error.message
      : undefined;

  return bodyMessage ?? `Request failed with status ${response.status}.`;
}

function isAbsoluteBaseUrl(baseUrl: string | URL): boolean {
  return baseUrl instanceof URL || ABSOLUTE_URL_PATTERN.test(String(baseUrl));
}

function getAbsoluteBaseUrl(baseUrl: string | URL): URL {
  return baseUrl instanceof URL ? baseUrl : new URL(String(baseUrl));
}

function getBasePathname(baseUrl: string | URL): string | undefined {
  const parsedBaseUrl = baseUrl instanceof URL
    ? new URL(baseUrl.toString())
    : isAbsoluteBaseUrl(baseUrl)
      ? new URL(String(baseUrl))
      : new URL(String(baseUrl), "http://bedrock.invalid");

  return normalizeBasePath(parsedBaseUrl.pathname);
}

function toFormData(value: unknown): FormData {
  if (value instanceof FormData) {
    return value;
  }

  if (typeof value !== "object" || value === null) {
    throw new Error("formData must be a FormData instance or a plain object.");
  }

  const formData = new FormData();

  for (const [key, entry] of Object.entries(value)) {
    appendFormDataValue(formData, key, entry);
  }

  return formData;
}

function appendFormDataValue(
  formData: FormData,
  key: string,
  value: unknown,
): void {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      appendFormDataValue(formData, key, entry);
    }

    return;
  }

  if (value instanceof Blob) {
    formData.append(key, value);
    return;
  }

  formData.append(key, String(value));
}

function toUrlEncodedBody(value: unknown): RuntimeBodyInit {
  if (value instanceof URLSearchParams) {
    return value.toString() as RuntimeBodyInit;
  }

  if (typeof value !== "object" || value === null) {
    throw new Error("form must be a URLSearchParams instance or a plain object.");
  }

  const params = new URLSearchParams();
  appendQuery(params, value as Record<string, QueryValue>);
  return params.toString() as RuntimeBodyInit;
}

function toBinaryBody(value: unknown): RuntimeBodyInit {
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || value instanceof Blob) {
    return value as RuntimeBodyInit;
  }

  throw new Error("binary must be a Uint8Array, ArrayBuffer, or Blob.");
}

function serializeCookies(cookies: Record<string, unknown>): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("; ");
}
