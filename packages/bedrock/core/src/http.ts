import { bootError } from "@bedrock/common";
import { z } from "zod";

import { freezeObject } from "./immutability";

export type HttpRequestData = {
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  body: unknown;
};

export type RuntimeHttpBodyReader = (
  descriptor: HttpRequestBodyDescriptor<any, any> | undefined,
) => Promise<unknown>;

export type RuntimeHttpRequest = {
  method: string;
  url: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  readBody?: RuntimeHttpBodyReader;
  raw?: unknown;
};

export type HttpOutputHeaders = Readonly<
  Record<string, string | readonly string[]>
>;

export type HttpCookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
};

export type HttpCookieMutation =
  | {
      kind: "set";
      name: string;
      value: string;
      options?: HttpCookieOptions;
    }
  | {
      kind: "delete";
      name: string;
      options?: Omit<HttpCookieOptions, "expires" | "maxAge">;
    };

type HttpRouteOutputInit = {
  headers?: HttpOutputHeaders;
  cookies?: readonly HttpCookieMutation[];
};

export type HttpRawBody =
  | string
  | Uint8Array
  | ArrayBuffer
  | ArrayBufferView
  | Blob
  | ReadableStream<Uint8Array>
  | null;

export type RuntimeHttpRawBody =
  | string
  | Uint8Array
  | ReadableStream<Uint8Array>
  | null;

export type RuntimeHttpResult =
  | ({
      kind: "json";
      status: number;
      body: string;
      statusText?: string;
    } & HttpRouteOutputInit)
  | ({
      kind: "text";
      status: number;
      body: string;
      statusText?: string;
    } & HttpRouteOutputInit)
  | ({
      kind: "binary";
      status: number;
      body: Uint8Array;
      statusText?: string;
    } & HttpRouteOutputInit)
  | ({
      kind: "empty";
      status: number;
      statusText?: string;
    } & HttpRouteOutputInit)
  | ({
      kind: "redirect";
      status: number;
      location: string;
    } & HttpRouteOutputInit)
  | ({
      kind: "sse";
      status: number;
      source: AsyncIterable<unknown> | Iterable<unknown>;
    } & HttpRouteOutputInit)
  | ({
      kind: "raw";
      status: number;
      body: RuntimeHttpRawBody;
      statusText?: string;
      contentType?: string;
    } & HttpRouteOutputInit);

export type BoundHttpRoute = {
  id: string;
  controllerId: string;
  moduleName: string;
  controllerName: string;
  routeName: string;
  method: string;
  path: string;
  fullPath: string;
  summary?: string;
  description?: string;
  tags: readonly string[];
  execute(args: {
    request: RuntimeHttpRequest;
  }): Promise<RuntimeHttpResult>;
};

export type HttpMountDescriptor = {
  kind: "http-mount";
  name: string;
  basePath: string;
  handle(request: RuntimeHttpRequest): Promise<RuntimeHttpResult> | RuntimeHttpResult;
};

export type BoundHttpMount = {
  id: string;
  moduleName: string;
  name: string;
  basePath: string;
  fullPath: string;
  handle(request: RuntimeHttpRequest): Promise<RuntimeHttpResult>;
};

export type HttpRequestLogEntry = {
  method: string;
  pathname: string;
  status: number;
  durationMs: number;
  matched: boolean;
  moduleName?: string;
  controllerName?: string;
  routeName?: string;
  routePath?: string;
  fullPath?: string;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
};

export type HttpRequestObserver = {
  onComplete(entry: HttpRequestLogEntry): void | Promise<void>;
};

export type HttpServerHandle = {
  stop(): Promise<void> | void;
};

export type HttpAdapter = {
  readonly basePath?: string;
  registerRoutes(
    routes: readonly BoundHttpRoute[],
    options?: {
      mounts?: readonly BoundHttpMount[];
      observer?: HttpRequestObserver;
    },
  ): void;
  fetch(request: Request): Promise<Response>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

export type HttpBodyKind =
  | "json"
  | "formData"
  | "urlEncoded"
  | "text"
  | "binary";

export type HttpFiniteResponseKind = "json" | "text" | "binary" | "empty";

export type HttpSpecialResponseKind = "sse" | "redirect" | "raw";

export type HttpResponseKind = HttpFiniteResponseKind | HttpSpecialResponseKind;

export const HTTP_REQUEST_BODY_DESCRIPTOR_MARKER = Symbol.for(
  "@bedrock/http-request-body-descriptor",
);

export const HTTP_RESPONSE_DESCRIPTOR_MARKER = Symbol.for(
  "@bedrock/http-response-descriptor",
);

const HTTP_REPLY_OUTPUT_MARKER = Symbol.for("@bedrock/http-reply-output");

type HttpBodyDescriptorBase<
  TKind extends HttpBodyKind,
  TSchema extends z.ZodTypeAny,
> = Readonly<{
  kind: TKind;
  schema: TSchema;
  readonly [HTTP_REQUEST_BODY_DESCRIPTOR_MARKER]?: true;
}>;

type HttpResponseDescriptorBase<
  TKind extends HttpResponseKind,
  TSchema extends z.ZodTypeAny | undefined = undefined,
> = Readonly<{
  kind: TKind;
  schema?: TSchema;
  contentType?: string;
  readonly [HTTP_RESPONSE_DESCRIPTOR_MARKER]?: true;
}>;

export type HttpJsonRequestBodyDescriptor<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
> = HttpBodyDescriptorBase<"json", TSchema>;

export type HttpFormDataRequestBodyDescriptor<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
> = HttpBodyDescriptorBase<"formData", TSchema>;

export type HttpUrlEncodedRequestBodyDescriptor<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
> = HttpBodyDescriptorBase<"urlEncoded", TSchema>;

export type HttpTextRequestBodyDescriptor<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
> = HttpBodyDescriptorBase<"text", TSchema>;

export type HttpBinaryRequestBodyDescriptor<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
> = HttpBodyDescriptorBase<"binary", TSchema>;

export type HttpRequestBodyDescriptor<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TKind extends HttpBodyKind = HttpBodyKind,
> =
  | (TKind extends "json" ? HttpJsonRequestBodyDescriptor<TSchema> : never)
  | (TKind extends "formData" ? HttpFormDataRequestBodyDescriptor<TSchema> : never)
  | (TKind extends "urlEncoded"
      ? HttpUrlEncodedRequestBodyDescriptor<TSchema>
      : never)
  | (TKind extends "text" ? HttpTextRequestBodyDescriptor<TSchema> : never)
  | (TKind extends "binary" ? HttpBinaryRequestBodyDescriptor<TSchema> : never);

export type HttpJsonResponseDescriptor<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
> = HttpResponseDescriptorBase<"json", TSchema> & {
  schema: TSchema;
};

export type HttpTextResponseDescriptor<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
> = HttpResponseDescriptorBase<"text", TSchema> & {
  schema: TSchema;
};

export type HttpBinaryResponseDescriptor<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
> = HttpResponseDescriptorBase<"binary", TSchema> & {
  schema: TSchema;
};

export type HttpEmptyResponseDescriptor = HttpResponseDescriptorBase<"empty">;

export type HttpSseResponseDescriptor<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
> = HttpResponseDescriptorBase<"sse", TSchema> & {
  schema: TSchema;
};

export type HttpRedirectResponseDescriptor = HttpResponseDescriptorBase<"redirect">;

export type HttpRawResponseDescriptor = HttpResponseDescriptorBase<"raw">;

export type HttpResponseDescriptor<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TKind extends HttpResponseKind = HttpResponseKind,
> =
  | (TKind extends "json" ? HttpJsonResponseDescriptor<TSchema> : never)
  | (TKind extends "text" ? HttpTextResponseDescriptor<TSchema> : never)
  | (TKind extends "binary" ? HttpBinaryResponseDescriptor<TSchema> : never)
  | (TKind extends "empty" ? HttpEmptyResponseDescriptor : never)
  | (TKind extends "sse" ? HttpSseResponseDescriptor<TSchema> : never)
  | (TKind extends "redirect" ? HttpRedirectResponseDescriptor : never)
  | (TKind extends "raw" ? HttpRawResponseDescriptor : never);

export type HttpRequestSpec = {
  params?: z.ZodObject<any>;
  query?: z.ZodObject<any>;
  headers?: z.ZodObject<any>;
  cookies?: z.ZodObject<any>;
  body?: z.ZodTypeAny | HttpRequestBodyDescriptor<any, any>;
};

export type HttpSuccessResponses = Readonly<
  Record<number, z.ZodTypeAny | HttpResponseDescriptor<any, any>>
>;

export type HttpSseEvent<T> =
  | {
      data: T;
      event?: string;
      id?: string;
      retry?: number;
    }
  | {
      comment: string;
    };

type NormalizeHttpResponseDescriptor<
  TResponse,
> = TResponse extends HttpResponseDescriptor<any, any>
  ? TResponse
  : TResponse extends z.ZodTypeAny
    ? HttpJsonResponseDescriptor<TResponse>
    : never;

export type InferFiniteHttpResponseValue<TResponse> =
  NormalizeHttpResponseDescriptor<TResponse> extends infer TDescriptor
    ? TDescriptor extends {
          kind: "json";
          schema: infer TSchema extends z.ZodTypeAny;
        }
      ? z.output<TSchema>
      : TDescriptor extends {
            kind: "text";
            schema: infer TSchema extends z.ZodTypeAny;
          }
        ? z.output<TSchema>
        : TDescriptor extends {
              kind: "binary";
              schema: infer TSchema extends z.ZodTypeAny;
            }
          ? z.output<TSchema>
          : TDescriptor extends {
                kind: "empty";
              }
            ? undefined
            : never
    : never;

type InferSseResponseValue<TResponse> =
  NormalizeHttpResponseDescriptor<TResponse> extends {
    kind: "sse";
    schema: infer TSchema extends z.ZodTypeAny;
  }
    ? z.output<TSchema>
    : never;

type ResponseKindFor<TResponse> = NormalizeHttpResponseDescriptor<TResponse>["kind"];

type HttpReplyValueBase = HttpRouteOutputInit & {
  readonly [HTTP_REPLY_OUTPUT_MARKER]?: true;
};

export type HttpStatusOutput<
  TStatus extends number = number,
  TBody = unknown,
> = HttpReplyValueBase & {
  kind: "status";
  status: TStatus;
  body: TBody;
};

export type HttpRedirectOutput<TStatus extends number | undefined = number | undefined> =
  HttpReplyValueBase & {
    kind: "redirect";
    status?: TStatus;
    location: string;
  };

export type HttpSseOutput<
  TStatus extends number | undefined = number | undefined,
  TValue = unknown,
> = HttpReplyValueBase & {
  kind: "sse";
  status?: TStatus;
  source: AsyncIterable<TValue> | Iterable<TValue>;
};

export type HttpRawOutput<TStatus extends number | undefined = number | undefined> =
  HttpReplyValueBase & {
    kind: "raw";
    status?: TStatus;
    body: HttpRawBody;
    statusText?: string;
    contentType?: string;
  };

export type HttpReplyValue =
  | HttpStatusOutput<number, unknown>
  | HttpRedirectOutput<number | undefined>
  | HttpSseOutput<number | undefined, unknown>
  | HttpRawOutput<number | undefined>;

type StatusFiniteOutput<
  TStatus extends number,
  TResponse,
> = ResponseKindFor<TResponse> extends HttpFiniteResponseKind
  ? {
      status: TStatus;
      body: InferFiniteHttpResponseValue<TResponse>;
      headers?: HttpOutputHeaders;
      cookies?: readonly HttpCookieMutation[];
    }
  : never;

type StatusSpecialOutput<
  TStatus extends number,
  TResponse,
> = ResponseKindFor<TResponse> extends "redirect"
  ? HttpRedirectOutput<TStatus>
  : ResponseKindFor<TResponse> extends "sse"
    ? HttpSseOutput<TStatus, InferSseResponseValue<TResponse>>
    : ResponseKindFor<TResponse> extends "raw"
      ? HttpRawOutput<TStatus>
      : never;

type SpecialStatusesWithKind<
  TResponses extends HttpSuccessResponses,
  TKind extends HttpSpecialResponseKind,
> = {
  [TStatus in Extract<keyof TResponses, number>]:
    ResponseKindFor<TResponses[TStatus]> extends TKind ? TStatus : never;
}[Extract<keyof TResponses, number>];

type MaybeImplicitSpecialStatus<
  TResponses extends HttpSuccessResponses,
  TKind extends HttpSpecialResponseKind,
> = [SpecialStatusesWithKind<TResponses, TKind>] extends [never]
  ? never
  : HttpRedirectOutput<undefined>;

type RouteFiniteStatusOutput<TResponses extends HttpSuccessResponses> = {
  [TStatus in Extract<keyof TResponses, number>]:
    StatusFiniteOutput<TStatus, TResponses[TStatus]>;
}[Extract<keyof TResponses, number>];

type RouteSpecialStatusOutput<TResponses extends HttpSuccessResponses> =
  | {
      [TStatus in Extract<keyof TResponses, number>]:
        StatusSpecialOutput<TStatus, TResponses[TStatus]>;
    }[Extract<keyof TResponses, number>]
  | ([SpecialStatusesWithKind<TResponses, "redirect">] extends [never]
      ? never
      : HttpRedirectOutput<undefined>)
  | ([SpecialStatusesWithKind<TResponses, "sse">] extends [never]
      ? never
      : HttpSseOutput<undefined, unknown>)
  | ([SpecialStatusesWithKind<TResponses, "raw">] extends [never]
      ? never
      : HttpRawOutput<undefined>);

export type HttpRouteOutput<
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
> = RouteFiniteStatusOutput<TResponses> | RouteSpecialStatusOutput<TResponses>;

export type HttpErrorMapper = (args: {
  error: unknown;
  request: RuntimeHttpRequest;
  route?: BoundHttpRoute;
}) => RuntimeHttpResult | undefined | Promise<RuntimeHttpResult | undefined>;

export const HttpTextSchema = z.string();
export const HttpBinarySchema = z.custom<Uint8Array>(
  (value) => value instanceof Uint8Array,
  "Expected Uint8Array",
);

function markHttpRequestBodyDescriptor<TDescriptor extends HttpRequestBodyDescriptor>(
  descriptor: TDescriptor,
): TDescriptor {
  Object.defineProperty(descriptor, HTTP_REQUEST_BODY_DESCRIPTOR_MARKER, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return descriptor;
}

function markHttpResponseDescriptor<TDescriptor extends HttpResponseDescriptor>(
  descriptor: TDescriptor,
): TDescriptor {
  Object.defineProperty(descriptor, HTTP_RESPONSE_DESCRIPTOR_MARKER, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return descriptor;
}

function markHttpReplyValue<TDescriptor extends HttpReplyValue>(
  descriptor: TDescriptor,
): TDescriptor {
  Object.defineProperty(descriptor, HTTP_REPLY_OUTPUT_MARKER, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return descriptor;
}

function createBodyDescriptor<
  TKind extends HttpBodyKind,
  TSchema extends z.ZodTypeAny,
>(
  kind: TKind,
  schema: TSchema,
): HttpRequestBodyDescriptor<TSchema, TKind> {
  return freezeObject(
    markHttpRequestBodyDescriptor({
      kind,
      schema,
    } as HttpRequestBodyDescriptor<TSchema, TKind>),
  );
}

function createResponseDescriptor<
  TKind extends HttpResponseKind,
  TSchema extends z.ZodTypeAny | undefined = undefined,
>(
  kind: TKind,
  options: {
    schema?: TSchema;
    contentType?: string;
  } = {},
): HttpResponseDescriptor<NonNullable<TSchema>, TKind> {
  return freezeObject(
    markHttpResponseDescriptor({
      kind,
      schema: options.schema,
      contentType: options.contentType,
    } as HttpResponseDescriptor<NonNullable<TSchema>, TKind>),
  );
}

function createStatusReply<TStatus extends number, TBody>(
  status: TStatus,
  body: TBody,
  init: HttpRouteOutputInit = {},
): HttpStatusOutput<TStatus, TBody> {
  return freezeObject(
    markHttpReplyValue({
      kind: "status",
      status,
      body,
      ...init,
    }),
  );
}

function createRedirectReply<TStatus extends number | undefined>(
  location: string,
  status?: TStatus,
  init: HttpRouteOutputInit = {},
): HttpRedirectOutput<TStatus> {
  return freezeObject(
    markHttpReplyValue({
      kind: "redirect",
      status,
      location,
      ...init,
    }),
  );
}

function createSseReply<TStatus extends number | undefined, TValue>(
  source: AsyncIterable<TValue> | Iterable<TValue>,
  status?: TStatus,
  init: HttpRouteOutputInit = {},
): HttpSseOutput<TStatus, TValue> {
  return freezeObject(
    markHttpReplyValue({
      kind: "sse",
      status,
      source,
      ...init,
    }),
  );
}

function createRawReply<TStatus extends number | undefined>(
  body: HttpRawBody,
  options: {
    status?: TStatus;
    statusText?: string;
    contentType?: string;
    headers?: HttpOutputHeaders;
    cookies?: readonly HttpCookieMutation[];
  } = {},
): HttpRawOutput<TStatus> {
  return freezeObject(
    markHttpReplyValue({
      kind: "raw",
      status: options.status,
      body,
      statusText: options.statusText,
      contentType: options.contentType,
      headers: options.headers,
      cookies: options.cookies,
    }),
  );
}

function createHttpRedirectReply(
  location: string,
  init?: HttpRouteOutputInit,
): HttpRedirectOutput<undefined>;
function createHttpRedirectReply<TStatus extends number>(
  status: TStatus,
  location: string,
  init?: HttpRouteOutputInit,
): HttpRedirectOutput<TStatus>;
function createHttpRedirectReply<TStatus extends number>(
  statusOrLocation: TStatus | string,
  locationOrInit?: string | HttpRouteOutputInit,
  maybeInit?: HttpRouteOutputInit,
): HttpRedirectOutput<TStatus | undefined> {
  if (typeof statusOrLocation === "string") {
    return createRedirectReply(
      statusOrLocation,
      undefined,
      locationOrInit as HttpRouteOutputInit | undefined,
    );
  }

  return createRedirectReply(
    locationOrInit as string,
    statusOrLocation,
    maybeInit,
  );
}

function createHttpSseReply<TValue>(
  source: AsyncIterable<TValue> | Iterable<TValue>,
  init?: HttpRouteOutputInit,
): HttpSseOutput<undefined, TValue>;
function createHttpSseReply<TStatus extends number, TValue>(
  status: TStatus,
  source: AsyncIterable<TValue> | Iterable<TValue>,
  init?: HttpRouteOutputInit,
): HttpSseOutput<TStatus, TValue>;
function createHttpSseReply<TStatus extends number, TValue>(
  statusOrSource: TStatus | AsyncIterable<TValue> | Iterable<TValue>,
  sourceOrInit?:
    | AsyncIterable<TValue>
    | Iterable<TValue>
    | HttpRouteOutputInit,
  maybeInit?: HttpRouteOutputInit,
): HttpSseOutput<TStatus | undefined, TValue> {
  if (typeof statusOrSource === "number") {
    return createSseReply(
      sourceOrInit as AsyncIterable<TValue> | Iterable<TValue>,
      statusOrSource,
      maybeInit,
    );
  }

  return createSseReply(
    statusOrSource,
    undefined,
    sourceOrInit as HttpRouteOutputInit | undefined,
  );
}

export const http = freezeObject({
  body: freezeObject({
    json<TSchema extends z.ZodTypeAny>(schema: TSchema) {
      return createBodyDescriptor("json", schema);
    },
    formData<TSchema extends z.ZodTypeAny>(schema: TSchema) {
      return createBodyDescriptor("formData", schema);
    },
    urlEncoded<TSchema extends z.ZodTypeAny>(schema: TSchema) {
      return createBodyDescriptor("urlEncoded", schema);
    },
    text<TSchema extends z.ZodTypeAny = typeof HttpTextSchema>(
      schema: TSchema = HttpTextSchema as unknown as TSchema,
    ) {
      return createBodyDescriptor("text", schema);
    },
    binary<TSchema extends z.ZodTypeAny = typeof HttpBinarySchema>(
      schema: TSchema = HttpBinarySchema as unknown as TSchema,
    ) {
      return createBodyDescriptor("binary", schema);
    },
  }),
  response: freezeObject({
    json<TSchema extends z.ZodTypeAny>(schema: TSchema) {
      return createResponseDescriptor("json", { schema });
    },
    text<TSchema extends z.ZodTypeAny = typeof HttpTextSchema>(
      schema: TSchema = HttpTextSchema as unknown as TSchema,
    ) {
      return createResponseDescriptor("text", { schema });
    },
    binary<TSchema extends z.ZodTypeAny = typeof HttpBinarySchema>(
      schema: TSchema = HttpBinarySchema as unknown as TSchema,
    ) {
      return createResponseDescriptor("binary", { schema });
    },
    empty() {
      return createResponseDescriptor("empty");
    },
    sse<TSchema extends z.ZodTypeAny>(schema: TSchema) {
      return createResponseDescriptor("sse", { schema });
    },
    redirect() {
      return createResponseDescriptor("redirect");
    },
    raw(options: {
      contentType?: string;
    } = {}) {
      return createResponseDescriptor("raw", {
        contentType: options.contentType,
      });
    },
  }),
  reply: freezeObject({
    status<TStatus extends number, TBody>(
      status: TStatus,
      body: TBody,
      init?: HttpRouteOutputInit,
    ) {
      return createStatusReply(status, body, init);
    },
    ok<TBody>(body: TBody, init?: HttpRouteOutputInit) {
      return createStatusReply(200, body, init);
    },
    created<TBody>(body: TBody, init?: HttpRouteOutputInit) {
      return createStatusReply(201, body, init);
    },
    accepted<TBody>(body: TBody, init?: HttpRouteOutputInit) {
      return createStatusReply(202, body, init);
    },
    redirect: createHttpRedirectReply,
    sse: createHttpSseReply,
    raw(
      body: HttpRawBody,
      options?: {
        status?: number;
        statusText?: string;
        contentType?: string;
        headers?: HttpOutputHeaders;
        cookies?: readonly HttpCookieMutation[];
      },
    ) {
      return createRawReply(body, options);
    },
  }),
});

export function defineHttpMount(
  name: string,
  def: {
    basePath: string;
    handle(
      request: RuntimeHttpRequest,
    ): Promise<RuntimeHttpResult> | RuntimeHttpResult;
  },
): HttpMountDescriptor {
  return freezeObject({
    kind: "http-mount",
    name,
    basePath: def.basePath,
    handle: def.handle,
  });
}

export function isHttpRequestBodyDescriptor(
  value: unknown,
): value is HttpRequestBodyDescriptor<any, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as HttpRequestBodyDescriptor)[HTTP_REQUEST_BODY_DESCRIPTOR_MARKER] === true
  );
}

export function isHttpResponseDescriptor(
  value: unknown,
): value is HttpResponseDescriptor<any, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as HttpResponseDescriptor)[HTTP_RESPONSE_DESCRIPTOR_MARKER] === true
  );
}

export function isHttpReplyValue(value: unknown): value is HttpReplyValue {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as HttpReplyValue)[HTTP_REPLY_OUTPUT_MARKER] === true
  );
}

export function normalizeHttpRequestBodyDescriptor(
  body:
    | z.ZodTypeAny
    | HttpRequestBodyDescriptor<any, any>
    | undefined,
): HttpRequestBodyDescriptor<any, any> | undefined {
  if (body === undefined) {
    return undefined;
  }

  return isHttpRequestBodyDescriptor(body) ? body : http.body.json(body);
}

export function normalizeHttpResponseDescriptor(
  response: z.ZodTypeAny | HttpResponseDescriptor<any, any>,
): HttpResponseDescriptor<any, any> {
  return isHttpResponseDescriptor(response)
    ? response
    : http.response.json(response);
}

export function isHttpFiniteResponseKind(
  kind: HttpResponseKind,
): kind is HttpFiniteResponseKind {
  return (
    kind === "json" || kind === "text" || kind === "binary" || kind === "empty"
  );
}

export function validateHttpRequestSpec(
  routeId: string,
  request: HttpRequestSpec | undefined,
): void {
  if (!request) {
    return;
  }

  validateRequestObjectSchema(routeId, "params", request.params);
  validateRequestObjectSchema(routeId, "query", request.query);
  validateRequestObjectSchema(routeId, "headers", request.headers);
  validateRequestObjectSchema(routeId, "cookies", request.cookies);

  if (
    request.body !== undefined &&
    !(request.body instanceof z.ZodType) &&
    !isHttpRequestBodyDescriptor(request.body)
  ) {
    throw bootError(
      `HTTP route "${routeId}" must declare a Zod schema or request body descriptor for request.body.`,
      {
        routeId,
      },
    );
  }
}

function validateRequestObjectSchema(
  routeId: string,
  section: "params" | "query" | "headers" | "cookies",
  schema: z.ZodTypeAny | undefined,
): void {
  if (schema === undefined) {
    return;
  }

  if (!(schema instanceof z.ZodObject)) {
    throw bootError(
      `HTTP route "${routeId}" must use z.object(...) for request.${section}.`,
      {
        routeId,
        section,
      },
    );
  }
}
