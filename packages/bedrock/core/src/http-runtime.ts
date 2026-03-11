import {
  bedrockError,
  isBedrockError,
  routeContractError,
  validationError,
  type BedrockError,
} from "@bedrock/common";
import { z } from "zod";

import {
  HttpBinarySchema,
  HttpTextSchema,
  http,
  isHttpReplyValue,
  normalizeHttpRequestBodyDescriptor,
  normalizeHttpResponseDescriptor,
  type HttpCookieMutation,
  type HttpCookieOptions,
  type HttpRequestBodyDescriptor,
  type HttpRequestData,
  type HttpRequestSpec,
  type HttpResponseDescriptor,
  type HttpSseEvent,
  type HttpSuccessResponses,
  type RuntimeHttpBodyReader,
  type RuntimeHttpRawBody,
  type RuntimeHttpRequest,
  type RuntimeHttpResult,
} from "./http";
import { freezeObject } from "./immutability";
import { parseWithSchema } from "./runtime/support";

const JSON_RESPONSE_HEADERS: Readonly<Record<string, string>> = freezeObject({
  "content-type": "application/json; charset=utf-8",
});
const TEXT_RESPONSE_HEADERS: Readonly<Record<string, string>> = freezeObject({
  "content-type": "text/plain; charset=utf-8",
});
const BINARY_RESPONSE_HEADERS: Readonly<Record<string, string>> = freezeObject({
  "content-type": "application/octet-stream",
});
const EMPTY_STRING_RECORD = freezeObject({}) as Record<string, string>;
const EMPTY_STRING_OR_ARRAY_RECORD = freezeObject({}) as Record<
  string,
  string | string[]
>;
const EMPTY_PARAMS_RECORD = freezeObject({}) as Record<string, string>;
const EMPTY_COOKIE_MUTATIONS = freezeObject(
  [],
) as readonly HttpCookieMutation[];
const EMPTY_PARSED_REQUEST_DATA = freezeObject({
  params: EMPTY_PARAMS_RECORD,
  query: EMPTY_STRING_OR_ARRAY_RECORD,
  headers: EMPTY_STRING_RECORD,
  cookies: EMPTY_STRING_RECORD,
  body: undefined,
}) as HttpRequestData;
type RuntimeFormDataEntryValue = string | Blob;
type RuntimeFormData = {
  keys(): IterableIterator<string>;
  getAll(name: string): RuntimeFormDataEntryValue[];
};
type WebHeadersLike = {
  get(name: string): string | null;
  entries(): IterableIterator<[string, string]>;
};
type WebRequestLike = {
  method: string;
  url: string;
  headers: WebHeadersLike;
  bodyUsed: boolean;
  clone(): WebRequestLike;
  json(): Promise<unknown>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  formData(): Promise<RuntimeFormData>;
};
type ResponseBodyInit = Exclude<
  ConstructorParameters<typeof Response>[0],
  undefined
>;

type HttpRequestParserResult = {
  getRequestData(): HttpRequestData;
  parsedRequestData: HttpRequestData;
};

export type HttpRequestParser = (args: {
  request: RuntimeHttpRequest;
}) => Promise<HttpRequestParserResult>;

export type HttpRouteResponseFinalizer = (args: {
  result: unknown;
}) => Promise<RuntimeHttpResult>;

type NormalizedResponseEntry = readonly [
  number,
  HttpResponseDescriptor<any, any>,
];
type ResponseDescriptorByStatus = ReadonlyMap<
  number,
  HttpResponseDescriptor<any, any>
>;
type FiniteResponsePayloadFactory = NonNullable<
  ReturnType<typeof createFiniteResponsePayloadFactory>
>;

type FiniteOutputEnvelope = {
  status: number;
  body: unknown;
  headers?: Record<string, string | readonly string[]>;
  cookies?: readonly HttpCookieMutation[];
};

type ResolvedSpecialRouteOutput =
  | {
      kind: "redirect";
      status?: number;
      location: string;
      headers?: Record<string, string | readonly string[]>;
      cookies?: readonly HttpCookieMutation[];
    }
  | {
      kind: "sse";
      status?: number;
      source: AsyncIterable<unknown> | Iterable<unknown>;
      headers?: Record<string, string | readonly string[]>;
      cookies?: readonly HttpCookieMutation[];
    }
  | {
      kind: "raw";
      status?: number;
      body: RuntimeHttpRawBody;
      statusText?: string;
      contentType?: string;
      headers?: Record<string, string | readonly string[]>;
      cookies?: readonly HttpCookieMutation[];
    };

type SpecialRuntimeResult =
  | Extract<RuntimeHttpResult, { kind: "redirect" }>
  | Extract<RuntimeHttpResult, { kind: "sse" }>
  | Extract<RuntimeHttpResult, { kind: "raw" }>;

export function createHttpRequestParser(args: {
  routeId: string;
  requestSpec: HttpRequestSpec | undefined;
}): HttpRequestParser {
  const hasParams = args.requestSpec?.params !== undefined;
  const hasQuery = args.requestSpec?.query !== undefined;
  const hasHeaders = args.requestSpec?.headers !== undefined;
  const hasCookies = args.requestSpec?.cookies !== undefined;
  const normalizedBodyDescriptor = normalizeHttpRequestBodyDescriptor(
    args.requestSpec?.body,
  );
  const bodySchema =
    args.requestSpec?.body !== undefined
      ? (normalizedBodyDescriptor?.schema ?? http.body.json(z.unknown()).schema)
      : undefined;

  if (
    !hasParams &&
    !hasQuery &&
    !hasHeaders &&
    !hasCookies &&
    bodySchema === undefined
  ) {
    return async ({ request }) => ({
      getRequestData: () => createRequestData(request, undefined),
      parsedRequestData: EMPTY_PARSED_REQUEST_DATA,
    });
  }

  return async ({ request }) => {
    const body =
      bodySchema !== undefined
        ? await readRequestBody(args.routeId, request, normalizedBodyDescriptor)
        : undefined;
    let requestData: HttpRequestData | undefined;
    const getRequestData = () =>
      (requestData ??= createRequestData(request, body));
    const currentRequestData = getRequestData();

    return {
      getRequestData,
      parsedRequestData: freezeObject({
        params: hasParams
          ? ((await parseWithSchema(
              args.requestSpec!.params!,
              currentRequestData.params,
              `Invalid params for "${args.routeId}".`,
              {
                routeId: args.routeId,
                stage: "input",
                section: "params",
              },
            )) as Record<string, string>)
          : EMPTY_PARAMS_RECORD,
        query: hasQuery
          ? ((await parseWithSchema(
              args.requestSpec!.query!,
              currentRequestData.query,
              `Invalid query for "${args.routeId}".`,
              {
                routeId: args.routeId,
                stage: "input",
                section: "query",
              },
            )) as Record<string, string | string[]>)
          : EMPTY_STRING_OR_ARRAY_RECORD,
        headers: hasHeaders
          ? ((await parseWithSchema(
              args.requestSpec!.headers!,
              currentRequestData.headers,
              `Invalid headers for "${args.routeId}".`,
              {
                routeId: args.routeId,
                stage: "input",
                section: "headers",
              },
            )) as Record<string, string>)
          : EMPTY_STRING_RECORD,
        cookies: hasCookies
          ? ((await parseWithSchema(
              args.requestSpec!.cookies!,
              currentRequestData.cookies,
              `Invalid cookies for "${args.routeId}".`,
              {
                routeId: args.routeId,
                stage: "input",
                section: "cookies",
              },
            )) as Record<string, string>)
          : EMPTY_STRING_RECORD,
        body:
          bodySchema !== undefined
            ? await parseWithSchema(
                bodySchema,
                currentRequestData.body,
                `Invalid body for "${args.routeId}".`,
                {
                  routeId: args.routeId,
                  stage: "input",
                  section: "body",
                },
              )
            : undefined,
      }) as HttpRequestData,
    };
  };
}

export function createHttpRouteResponseFinalizer(args: {
  routeId: string;
  responses: HttpSuccessResponses;
}): HttpRouteResponseFinalizer {
  const entries = getNormalizedResponseEntries(args.responses);
  const responseDescriptorByStatus = createResponseDescriptorByStatus(entries);
  const finiteResponsePayloadFactoryByStatus = createFiniteResponsePayloadFactoryByStatus(
    args.routeId,
    entries,
  );
  const singleFiniteResponse =
    entries.length === 1
      ? (finiteResponsePayloadFactoryByStatus.get(entries[0]![0]) ?? null)
      : null;

  return async ({ result }) => {
    const finite = normalizeFiniteRouteOutput(result);

    if (finite) {
      return finalizePrecomputedFiniteRouteOutput({
        routeId: args.routeId,
        status: finite.status,
        responseDescriptorByStatus,
        finiteResponsePayloadFactoryByStatus,
        value: finite.body,
        headers: finite.headers,
        cookies: finite.cookies,
      });
    }

    const special = normalizeSpecialRouteOutput(result);

    if (special) {
      return finalizeSpecialRouteOutput({
        routeId: args.routeId,
        entries,
        output: special,
      });
    }

    if (singleFiniteResponse) {
      return singleFiniteResponse(result, {});
    }

    throw routeContractError();
  };
}

export function finalizeHttpErrorResponse(args: {
  error: unknown;
}): RuntimeHttpResult {
  const bedrockErrorValue = toBedrockError(args.error);

  return {
    kind: "json",
    status: bedrockErrorValue.status ?? 500,
    body: JSON.stringify({
      error: {
        code: bedrockErrorValue.code,
        message: bedrockErrorValue.message,
        details: bedrockErrorValue.details,
      },
    }),
    headers: JSON_RESPONSE_HEADERS,
  };
}

export function createRuntimeHttpRequestFromWebRequest(
  request: WebRequestLike,
  options: {
    params?: Record<string, string>;
    path?: string;
    raw?: unknown;
  } = {},
): RuntimeHttpRequest {
  let query: Record<string, string | string[]> | undefined;
  let headers: Record<string, string> | undefined;
  let cookies: Record<string, string> | undefined;
  let bodyReader: RuntimeHttpBodyReader | undefined;
  let searchParams: URLSearchParams | undefined;
  let replayableRequest: WebRequestLike | undefined;
  const getReplayableRequest = () => {
    if (replayableRequest) {
      return replayableRequest;
    }

    if (request.bodyUsed) {
      return undefined;
    }

    replayableRequest = request.clone();
    return replayableRequest;
  };

  return {
    method: request.method,
    url: request.url,
    path: options.path ?? getPathnameFromUrl(request.url),
    params: options.params ?? EMPTY_PARAMS_RECORD,
    get query() {
      return (query ??= buildQueryValues(
        (searchParams ??= new URLSearchParams(getSearchFromUrl(request.url))),
      ));
    },
    get headers() {
      return (headers ??= buildHeaderValues(request.headers));
    },
    get cookies() {
      return (cookies ??= parseRequestCookies(request.headers.get("cookie")));
    },
    get readBody() {
      return (bodyReader ??= createWebBodyReader(request, getReplayableRequest));
    },
    get raw() {
      return options.raw ?? getReplayableRequest() ?? request;
    },
  };
}

export function runtimeHttpResultToResponse(
  result: RuntimeHttpResult,
): Response {
  switch (result.kind) {
    case "json":
      return createResponse(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers: mergeOutputHeaders(
          JSON_RESPONSE_HEADERS,
          result.headers,
          result.cookies,
        ),
      });
    case "text":
      return createResponse(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers: mergeOutputHeaders(
          TEXT_RESPONSE_HEADERS,
          result.headers,
          result.cookies,
        ),
      });
    case "binary":
      return createResponse(result.body as ResponseBodyInit, {
        status: result.status,
        statusText: result.statusText,
        headers: mergeOutputHeaders(
          BINARY_RESPONSE_HEADERS,
          result.headers,
          result.cookies,
        ),
      });
    case "empty":
      return createResponse(null, {
        status: result.status,
        statusText: result.statusText,
        headers: mergeOutputHeaders(undefined, result.headers, result.cookies),
      });
    case "redirect":
      return createResponse(null, {
        status: result.status,
        headers: mergeOutputHeaders(
          {
            location: result.location,
          },
          result.headers,
          result.cookies,
        ),
      });
    case "sse":
      return createResponse(
        createSseStream("shim", http.response.sse(z.unknown()), result.source),
        {
          status: result.status,
          headers: mergeOutputHeaders(
            {
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-cache",
            },
            result.headers,
            result.cookies,
          ),
        },
      );
    case "raw":
      return createResponse(result.body as ResponseBodyInit, {
        status: result.status,
        statusText: result.statusText,
        headers: mergeOutputHeaders(
          result.contentType
            ? {
                "content-type": result.contentType,
              }
            : undefined,
          result.headers,
          result.cookies,
        ),
      });
  }
}

export async function webResponseToRuntimeHttpResult(
  response: Response,
): Promise<RuntimeHttpResult> {
  const headers = readOutputHeaders(response.headers);
  const cookies = readCookieMutations(response.headers);
  const location = response.headers.get("location");

  if (
    location &&
    response.status >= 300 &&
    response.status < 400 &&
    response.body === null
  ) {
    return {
      kind: "redirect",
      status: response.status,
      location,
      headers: headers ?? undefined,
      cookies,
    };
  }

  if (response.body === null) {
    return {
      kind: "empty",
      status: response.status,
      statusText: response.statusText || undefined,
      headers: headers ?? undefined,
      cookies,
    };
  }

  return {
    kind: "raw",
    status: response.status,
    statusText: response.statusText || undefined,
    contentType: response.headers.get("content-type") ?? undefined,
    body: response.body as ReadableStream<Uint8Array>,
    headers: headers ?? undefined,
    cookies,
  };
}

export function buildQueryValues(
  searchParams: URLSearchParams,
): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};

  for (const key of new Set(searchParams.keys())) {
    const entries = searchParams.getAll(key);
    values[key] = entries.length > 1 ? entries : (entries[0] ?? "");
  }

  return values;
}

export function buildHeaderValues(
  headers: WebHeadersLike,
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [key, value] of headers.entries()) {
    values[key.toLowerCase()] = value;
  }

  return values;
}

function getPathnameFromUrl(url: string): string {
  const schemeIndex = url.indexOf("://");
  const pathStart = url.indexOf("/", schemeIndex === -1 ? 0 : schemeIndex + 3);

  if (pathStart === -1) {
    return "/";
  }

  let end = url.length;
  const queryIndex = url.indexOf("?", pathStart);
  const hashIndex = url.indexOf("#", pathStart);

  if (queryIndex !== -1) {
    end = queryIndex;
  }

  if (hashIndex !== -1 && hashIndex < end) {
    end = hashIndex;
  }

  return url.slice(pathStart, end) || "/";
}

function getSearchFromUrl(url: string): string {
  const queryIndex = url.indexOf("?");

  if (queryIndex === -1) {
    return "";
  }

  const hashIndex = url.indexOf("#", queryIndex);

  return hashIndex === -1
    ? url.slice(queryIndex + 1)
    : url.slice(queryIndex + 1, hashIndex);
}

export function parseRequestCookies(
  cookieHeader: string | null | undefined,
): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) {
    return cookies;
  }

  for (const entry of cookieHeader.split(";")) {
    const trimmed = entry.trim();

    if (trimmed.length === 0) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key =
      separatorIndex === -1 ? trimmed : trimmed.slice(0, separatorIndex);
    const rawValue =
      separatorIndex === -1 ? "" : trimmed.slice(separatorIndex + 1);

    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }

  return cookies;
}

function createRequestData(
  request: RuntimeHttpRequest,
  body: unknown,
): HttpRequestData {
  let params: Record<string, string> | undefined;
  let query: Record<string, string | string[]> | undefined;
  let headers: Record<string, string> | undefined;
  let cookies: Record<string, string> | undefined;

  return freezeObject({
    get params() {
      return (params ??= freezeStringRecord(request.params));
    },
    get query() {
      return (query ??= freezeStringOrArrayRecord(request.query));
    },
    get headers() {
      return (headers ??= freezeStringRecord(request.headers));
    },
    get cookies() {
      return (cookies ??= freezeStringRecord(request.cookies));
    },
    body,
  }) as HttpRequestData;
}

function freezeStringRecord(
  record: Record<string, string>,
): Record<string, string> {
  if (Object.keys(record).length === 0) {
    return EMPTY_STRING_RECORD;
  }

  return freezeObject({ ...record });
}

function freezeStringOrArrayRecord(
  record: Record<string, string | string[]>,
): Record<string, string | string[]> {
  if (Object.keys(record).length === 0) {
    return EMPTY_STRING_OR_ARRAY_RECORD;
  }

  const copy: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(record)) {
    copy[key] = Array.isArray(value) ? freezeObject([...value]) : value;
  }

  return freezeObject(copy);
}

async function readRequestBody(
  routeId: string,
  request: RuntimeHttpRequest,
  descriptor: HttpRequestBodyDescriptor<any, any> | undefined,
): Promise<unknown> {
  if (!descriptor || !request.readBody) {
    return undefined;
  }

  try {
    return await request.readBody(descriptor);
  } catch (error) {
    if (isBedrockError(error)) {
      throw error;
    }

    throw bedrockError({
      message: `Failed to read request body for "${routeId}".`,
      code: "BEDROCK_HTTP_REQUEST_BODY_READ_ERROR",
      status: 400,
      details: {
        routeId,
      },
    });
  }
}

function getNormalizedResponseEntries(
  responses: HttpSuccessResponses,
): NormalizedResponseEntry[] {
  return Object.entries(responses)
    .map(
      ([status, descriptor]) =>
        [
          Number(status),
          normalizeHttpResponseDescriptor(descriptor as never),
        ] as const,
    )
    .sort((left, right) => left[0] - right[0]);
}

function createResponseDescriptorByStatus(
  entries: readonly NormalizedResponseEntry[],
): ResponseDescriptorByStatus {
  return new Map(entries);
}

function createFiniteResponsePayloadFactoryByStatus(
  routeId: string,
  entries: readonly NormalizedResponseEntry[],
): ReadonlyMap<number, FiniteResponsePayloadFactory> {
  const factories = new Map<number, FiniteResponsePayloadFactory>();

  for (const [status, descriptor] of entries) {
    const factory = createFiniteResponsePayloadFactory({
      routeId,
      status,
      descriptor,
    });

    if (factory) {
      factories.set(status, factory);
    }
  }

  return factories;
}

function requireFiniteResponsePayloadFactory(args: {
  routeId: string;
  status: number;
  responseDescriptorByStatus: ResponseDescriptorByStatus;
  finiteResponsePayloadFactoryByStatus: ReadonlyMap<number, FiniteResponsePayloadFactory>;
}): FiniteResponsePayloadFactory {
  const descriptor = args.responseDescriptorByStatus.get(args.status);

  if (!descriptor) {
    throw validationError(
      `Route "${args.routeId}" does not declare success status ${args.status}.`,
      {
        routeId: args.routeId,
        status: args.status,
        stage: "output",
      },
    );
  }

  const factory = args.finiteResponsePayloadFactoryByStatus.get(args.status);

  if (!factory) {
    throw routeContractError();
  }

  return factory;
}

async function finalizePrecomputedFiniteRouteOutput(args: {
  routeId: string;
  status: number;
  responseDescriptorByStatus: ResponseDescriptorByStatus;
  finiteResponsePayloadFactoryByStatus: ReadonlyMap<number, FiniteResponsePayloadFactory>;
  value: unknown;
  headers?: Record<string, string | readonly string[]>;
  cookies?: readonly HttpCookieMutation[];
}): Promise<RuntimeHttpResult> {
  const factory = requireFiniteResponsePayloadFactory(args);

  return factory(args.value, {
    headers: args.headers,
    cookies: args.cookies,
  });
}

function normalizeFiniteRouteOutput(
  value: unknown,
): FiniteOutputEnvelope | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (isHttpReplyValue(value)) {
    if (value.kind !== "status") {
      return null;
    }

    const reply = value as {
      status?: unknown;
      body?: unknown;
      headers?: Record<string, string | readonly string[]>;
      cookies?: readonly HttpCookieMutation[];
    };

    return typeof reply.status === "number"
      ? {
          status: reply.status,
          body: reply.body,
          headers: reply.headers,
          cookies: reply.cookies,
        }
      : null;
  }

  if (!("status" in value) || !("body" in value)) {
    return null;
  }

  const envelope = value as {
    status?: unknown;
    body?: unknown;
    headers?: Record<string, string | readonly string[]>;
    cookies?: readonly HttpCookieMutation[];
  };

  if (typeof envelope.status !== "number") {
    return null;
  }

  return {
    status: envelope.status,
    body: envelope.body,
    headers: envelope.headers,
    cookies: envelope.cookies,
  };
}

function normalizeSpecialRouteOutput(
  value: unknown,
): ResolvedSpecialRouteOutput | null {
  if (!isHttpReplyValue(value)) {
    return null;
  }

  switch (value.kind) {
    case "redirect":
      return value;
    case "sse":
      return value;
    case "raw":
      return {
        kind: "raw",
        status: value.status,
        body: normalizeRawBody(value.body),
        statusText: value.statusText,
        contentType: value.contentType,
        headers: value.headers,
        cookies: value.cookies,
      };
    default:
      return null;
  }
}

function normalizeRawBody(body: unknown): RuntimeHttpRawBody {
  if (
    body === null ||
    body instanceof ReadableStream ||
    typeof body === "string"
  ) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return body;
  }

  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }

  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    throw routeContractError();
  }

  throw routeContractError();
}

function requireResponseDescriptor(
  routeId: string,
  entries: NormalizedResponseEntry[],
  status: number,
): HttpResponseDescriptor<any, any> {
  const matched = entries.find(([candidate]) => candidate === status)?.[1];

  if (!matched) {
    throw validationError(
      `Route "${routeId}" does not declare success status ${status}.`,
      {
        routeId,
        status,
        stage: "output",
      },
    );
  }

  return matched;
}

function resolveSingleReplyStatus(
  routeId: string,
  entries: NormalizedResponseEntry[],
  kind: HttpResponseDescriptor<any, any>["kind"],
): number {
  const matches = entries.filter(([, descriptor]) => descriptor.kind === kind);

  if (matches.length !== 1) {
    throw routeContractError();
  }

  const status = matches[0]?.[0];

  if (status === undefined) {
    throw routeContractError();
  }

  return status;
}

function createFiniteResponsePayloadFactory(args: {
  routeId: string;
  status: number;
  descriptor: HttpResponseDescriptor<any, any>;
}):
  | ((
      value: unknown,
      meta: {
        headers?: Record<string, string | readonly string[]>;
        cookies?: readonly HttpCookieMutation[];
      },
    ) => Promise<RuntimeHttpResult>)
  | null {
  switch (args.descriptor.kind) {
    case "json":
      return async (value, meta) => {
        const parsed = await parseWithSchema(
          args.descriptor.schema,
          value,
          `Invalid response for "${args.routeId}".`,
          {
            routeId: args.routeId,
            stage: "output",
            status: args.status,
          },
        );

        return {
          kind: "json",
          status: args.status,
          body: parsed === undefined ? "null" : JSON.stringify(parsed),
          headers: mergeFiniteResultHeaders(
            JSON_RESPONSE_HEADERS,
            meta.headers,
          ),
          cookies: meta.cookies ?? EMPTY_COOKIE_MUTATIONS,
        };
      };
    case "text":
      return async (value, meta) => {
        const parsed = await parseWithSchema(
          args.descriptor.schema ?? HttpTextSchema,
          value,
          `Invalid response for "${args.routeId}".`,
          {
            routeId: args.routeId,
            stage: "output",
            status: args.status,
          },
        );

        return {
          kind: "text",
          status: args.status,
          body: parsed,
          headers: mergeFiniteResultHeaders(
            TEXT_RESPONSE_HEADERS,
            meta.headers,
          ),
          cookies: meta.cookies ?? EMPTY_COOKIE_MUTATIONS,
        };
      };
    case "binary":
      return async (value, meta) => {
        const parsed = await parseWithSchema(
          args.descriptor.schema ?? HttpBinarySchema,
          value,
          `Invalid response for "${args.routeId}".`,
          {
            routeId: args.routeId,
            stage: "output",
            status: args.status,
          },
        );

        return {
          kind: "binary",
          status: args.status,
          body: parsed,
          headers: mergeFiniteResultHeaders(
            BINARY_RESPONSE_HEADERS,
            meta.headers,
          ),
          cookies: meta.cookies ?? EMPTY_COOKIE_MUTATIONS,
        };
      };
    case "empty":
      return async (value, meta) => {
        await parseWithSchema(
          z.undefined(),
          value,
          `Invalid response for "${args.routeId}".`,
          {
            routeId: args.routeId,
            stage: "output",
            status: args.status,
          },
        );

        return {
          kind: "empty",
          status: args.status,
          headers: meta.headers,
          cookies: meta.cookies ?? EMPTY_COOKIE_MUTATIONS,
        };
      };
    default:
      return null;
  }
}

async function finalizeSpecialRouteOutput(args: {
  routeId: string;
  entries: NormalizedResponseEntry[];
  output: ResolvedSpecialRouteOutput;
}): Promise<SpecialRuntimeResult> {
  switch (args.output.kind) {
    case "redirect": {
      const status =
        args.output.status ??
        resolveSingleReplyStatus(args.routeId, args.entries, "redirect");
      const descriptor = requireResponseDescriptor(
        args.routeId,
        args.entries,
        status,
      );

      if (descriptor.kind !== "redirect") {
        throw routeContractError();
      }

      return {
        kind: "redirect",
        status,
        location: args.output.location,
        headers: args.output.headers,
        cookies: args.output.cookies ?? EMPTY_COOKIE_MUTATIONS,
      };
    }
    case "sse": {
      const status =
        args.output.status ??
        resolveSingleReplyStatus(args.routeId, args.entries, "sse");
      const descriptor = requireResponseDescriptor(
        args.routeId,
        args.entries,
        status,
      );

      if (descriptor.kind !== "sse") {
        throw routeContractError();
      }

      return {
        kind: "sse",
        status,
        source: createValidatedSseSource(
          args.routeId,
          descriptor,
          args.output.source,
        ),
        headers: mergeFiniteResultHeaders(
          {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache",
          },
          args.output.headers,
        ),
        cookies: args.output.cookies ?? EMPTY_COOKIE_MUTATIONS,
      };
    }
    case "raw": {
      const status =
        args.output.status ??
        resolveSingleReplyStatus(args.routeId, args.entries, "raw");
      const descriptor = requireResponseDescriptor(
        args.routeId,
        args.entries,
        status,
      );

      if (descriptor.kind !== "raw") {
        throw routeContractError();
      }

      return {
        kind: "raw",
        status,
        statusText: args.output.statusText,
        body: args.output.body,
        contentType: args.output.contentType ?? descriptor.contentType,
        headers: args.output.headers,
        cookies: args.output.cookies ?? EMPTY_COOKIE_MUTATIONS,
      };
    }
  }
}

function createValidatedSseSource(
  routeId: string,
  descriptor: Extract<HttpResponseDescriptor<any, any>, { kind: "sse" }>,
  source: AsyncIterable<unknown> | Iterable<unknown>,
): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const value of source) {
        if (isCommentEvent(value)) {
          yield value;
          continue;
        }

        if (!isDataEvent(value)) {
          throw routeContractError();
        }

        const parsed = await parseWithSchema(
          descriptor.schema,
          value.data,
          `Invalid SSE event for "${routeId}".`,
          {
            routeId,
            stage: "output",
            section: "sse",
          },
        );

        yield {
          ...value,
          data: parsed,
        };
      }
    },
  };
}

function createSseStream(
  routeId: string,
  descriptor: Extract<HttpResponseDescriptor<any, any>, { kind: "sse" }>,
  source: AsyncIterable<unknown> | Iterable<unknown>,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        const encoder = new TextEncoder();

        try {
          for await (const event of createValidatedSseSource(
            routeId,
            descriptor,
            source,
          )) {
            controller.enqueue(encoder.encode(serializeSseEvent(event)));
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      })();
    },
  });
}

function serializeSseEvent(value: unknown): string {
  if (isCommentEvent(value)) {
    return `: ${value.comment}\n\n`;
  }

  if (!isDataEvent(value)) {
    throw routeContractError();
  }

  const lines: string[] = [];

  if (value.id !== undefined) {
    lines.push(`id: ${value.id}`);
  }
  if (value.event !== undefined) {
    lines.push(`event: ${value.event}`);
  }
  if (value.retry !== undefined) {
    lines.push(`retry: ${value.retry}`);
  }

  const serializedData = JSON.stringify(value.data);

  for (const line of serializedData.split("\n")) {
    lines.push(`data: ${line}`);
  }

  return `${lines.join("\n")}\n\n`;
}

function isCommentEvent(
  value: unknown,
): value is Extract<HttpSseEvent<unknown>, { comment: string }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "comment" in value &&
    typeof (value as { comment?: unknown }).comment === "string"
  );
}

function isDataEvent(
  value: unknown,
): value is Exclude<HttpSseEvent<unknown>, { comment: string }> {
  return typeof value === "object" && value !== null && "data" in value;
}

function mergeFiniteResultHeaders(
  base: Record<string, string>,
  headers: Record<string, string | readonly string[]> | undefined,
): Record<string, string | readonly string[]> {
  if (!headers) {
    return base;
  }

  return {
    ...base,
    ...headers,
  };
}

function readOutputHeaders(
  headers: Headers,
): Record<string, string | readonly string[]> | null {
  const values: Record<string, string | readonly string[]> = {};

  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }

    values[key] = value;
  });

  return Object.keys(values).length > 0 ? values : null;
}

function readCookieMutations(headers: Headers): readonly HttpCookieMutation[] {
  const setCookies = readSetCookieHeaders(headers)
    .map(parseSetCookieHeader)
    .filter((value): value is HttpCookieMutation => value !== null);

  if (setCookies.length === 0) {
    return EMPTY_COOKIE_MUTATIONS;
  }

  return freezeObject([...setCookies]) as readonly HttpCookieMutation[];
}

function createResponse(
  body: ResponseBodyInit | null,
  init: ResponseInit,
): Response {
  return new Response(body, init);
}

function mergeOutputHeaders(
  base: Record<string, string> | undefined,
  headers: Record<string, string | readonly string[]> | undefined,
  cookies: readonly HttpCookieMutation[] | undefined,
): Headers {
  const merged = new Headers(base);

  if (headers) {
    for (const [name, value] of Object.entries(headers)) {
      merged.delete(name);

      if (Array.isArray(value)) {
        for (const entry of value) {
          merged.append(name, entry);
        }

        continue;
      }

      merged.set(name, value as string);
    }
  }

  for (const cookie of cookies ?? EMPTY_COOKIE_MUTATIONS) {
    merged.append(
      "set-cookie",
      cookie.kind === "set"
        ? serializeCookie(cookie.name, cookie.value, cookie.options)
        : serializeCookie(cookie.name, "", {
            ...cookie.options,
            expires: new Date(0),
            maxAge: 0,
          }),
    );
  }

  return merged;
}

function readSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (
    headers as Headers & {
      getSetCookie?: () => string[];
    }
  ).getSetCookie;

  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers);
  }

  const value = headers.get("set-cookie");
  return value ? splitSetCookieHeader(value) : [];
}

function splitSetCookieHeader(value: string): string[] {
  return value
    .split(/,\s*(?=[^;]+=[^;]+)/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseSetCookieHeader(value: string): HttpCookieMutation | null {
  const [rawNameAndValue, ...attributes] = value
    .split(";")
    .map((entry) => entry.trim());

  if (!rawNameAndValue) {
    return null;
  }

  const separatorIndex = rawNameAndValue.indexOf("=");

  if (separatorIndex <= 0) {
    return null;
  }

  const name = rawNameAndValue.slice(0, separatorIndex).trim();
  const rawCookieValue = rawNameAndValue.slice(separatorIndex + 1);

  if (name.length === 0) {
    return null;
  }

  const options: HttpCookieOptions = {};

  for (const attribute of attributes) {
    if (attribute.length === 0) {
      continue;
    }

    const [rawKey, ...rawValueParts] = attribute.split("=");
    const key = rawKey?.trim().toLowerCase();
    const attributeValue = rawValueParts.join("=").trim();

    switch (key) {
      case "domain":
        if (attributeValue.length > 0) {
          options.domain = attributeValue;
        }
        break;
      case "path":
        if (attributeValue.length > 0) {
          options.path = attributeValue;
        }
        break;
      case "expires": {
        const expiresAt = new Date(attributeValue);

        if (!Number.isNaN(expiresAt.getTime())) {
          options.expires = expiresAt;
        }
        break;
      }
      case "max-age": {
        const maxAge = Number.parseInt(attributeValue, 10);

        if (Number.isFinite(maxAge)) {
          options.maxAge = maxAge;
        }
        break;
      }
      case "httponly":
        options.httpOnly = true;
        break;
      case "secure":
        options.secure = true;
        break;
      case "samesite": {
        const sameSite = attributeValue.toLowerCase();

        if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
          options.sameSite = sameSite;
        }
        break;
      }
    }
  }

  return {
    kind: "set",
    name,
    value: decodeCookieValue(rawCookieValue),
    options: Object.keys(options).length > 0 ? options : undefined,
  };
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function createWebBodyReader(
  request: WebRequestLike,
  getReplayableRequest: () => WebRequestLike | undefined,
): RuntimeHttpBodyReader {
  const cache = new Map<string, Promise<unknown>>();

  return (descriptor) => {
    const normalizedDescriptor = normalizeHttpRequestBodyDescriptor(descriptor);
    const kind = normalizedDescriptor?.kind ?? "json";
    const cached = cache.get(kind);

    if (cached) {
      return cached;
    }

    const pending = parseWebRequestBody(
      request,
      getReplayableRequest,
      normalizedDescriptor,
    );
    cache.set(kind, pending);
    return pending;
  };
}

async function parseWebRequestBody(
  request: WebRequestLike,
  getReplayableRequest: () => WebRequestLike | undefined,
  descriptor: HttpRequestBodyDescriptor<any, any> | undefined,
): Promise<unknown> {
  if (!descriptor) {
    return undefined;
  }

  switch (descriptor.kind) {
    case "json":
      return readJsonBody(request, getReplayableRequest);
    case "formData":
      return readFormDataBody(request, getReplayableRequest, "multipart/form-data");
    case "urlEncoded":
      return readFormDataBody(
        request,
        getReplayableRequest,
        "application/x-www-form-urlencoded",
      );
    case "text":
      return readTextBody(request, getReplayableRequest);
    case "binary":
      return readBinaryBody(request, getReplayableRequest);
  }
}

async function readJsonBody(
  request: WebRequestLike,
  getReplayableRequest: () => WebRequestLike | undefined,
): Promise<unknown> {
  const contentType = request.headers.get("content-type");
  const source = getReadableWebRequest(request, getReplayableRequest);

  if (contentType && matchesJsonContentType(contentType)) {
    try {
      return await source.json();
    } catch (error) {
      if (
        request.headers.get("content-length") === "0" &&
        error instanceof SyntaxError
      ) {
        return undefined;
      }

      throw validationError("Invalid JSON request body.", {
        cause: error,
      });
    }
  }

  const text = await source.text();

  if (text.length === 0) {
    return undefined;
  }

  if (!matchesJsonContentType(contentType)) {
    throw unsupportedMediaType(contentType);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw validationError("Invalid JSON request body.", {
      cause: error,
    });
  }
}

async function readTextBody(
  request: WebRequestLike,
  getReplayableRequest: () => WebRequestLike | undefined,
): Promise<unknown> {
  const text = await getReadableWebRequest(request, getReplayableRequest).text();

  if (text.length === 0) {
    return undefined;
  }

  if (!matchesContentType(request.headers.get("content-type"), "text/plain")) {
    throw unsupportedMediaType(request.headers.get("content-type"));
  }

  return text;
}

async function readBinaryBody(
  request: WebRequestLike,
  getReplayableRequest: () => WebRequestLike | undefined,
): Promise<unknown> {
  const bytes = new Uint8Array(
    await getReadableWebRequest(request, getReplayableRequest).arrayBuffer(),
  );

  if (bytes.byteLength === 0) {
    return undefined;
  }

  if (
    !matchesContentType(
      request.headers.get("content-type"),
      "application/octet-stream",
    )
  ) {
    throw unsupportedMediaType(request.headers.get("content-type"));
  }

  return bytes;
}

async function readFormDataBody(
  request: WebRequestLike,
  getReplayableRequest: () => WebRequestLike | undefined,
  expectedContentType:
    | "multipart/form-data"
    | "application/x-www-form-urlencoded",
): Promise<unknown> {
  const source = getReadableWebRequest(request, getReplayableRequest);
  const formData = await source.formData();

  if ([...formData.keys()].length === 0) {
    return {};
  }

  if (
    !matchesContentType(
      request.headers.get("content-type"),
      expectedContentType,
    )
  ) {
    throw unsupportedMediaType(request.headers.get("content-type"));
  }
  return normalizeFormData(formData);
}

function getReadableWebRequest(
  request: WebRequestLike,
  getReplayableRequest: () => WebRequestLike | undefined,
): WebRequestLike {
  if (!request.bodyUsed) {
    return request;
  }

  const replayableRequest = getReplayableRequest();

  if (!replayableRequest) {
    throw bedrockError({
      message: "Request body has already been consumed and cannot be replayed.",
      code: "BEDROCK_HTTP_REQUEST_BODY_REPLAY_UNAVAILABLE",
      status: 400,
    });
  }

  return replayableRequest.clone();
}

function normalizeFormData(
  formData: RuntimeFormData,
): Record<string, RuntimeFormDataEntryValue | RuntimeFormDataEntryValue[]> {
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

function unsupportedMediaType(contentType: string | null): BedrockError {
  return bedrockError({
    message: "Unsupported media type.",
    code: "BEDROCK_HTTP_UNSUPPORTED_MEDIA_TYPE",
    status: 415,
    details: {
      contentType,
    },
  });
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

function serializeCookie(
  name: string,
  value: string,
  options: HttpCookieOptions | undefined,
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
  return value.length === 0
    ? value
    : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

function toBedrockError(error: unknown): BedrockError {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error as BedrockError;
  }

  return bedrockError({
    message: "Internal server error.",
    code: "BEDROCK_HTTP_INTERNAL_ERROR",
    status: 500,
  });
}
