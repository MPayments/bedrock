import type { Simplify } from "@bedrock/common";
import type {
  AppDescriptor,
  AppRouteContracts,
  HttpErrorDescriptor,
  HttpRouteContract,
  HttpMethod,
  HttpRequestBodyDescriptor,
  HttpRequestSpec,
  HttpResponseDescriptor,
  HttpSuccessResponses,
  RouteErrorsConfig,
} from "@bedrock/core";
import type { z } from "zod";

type RequestHeadersInit = ConstructorParameters<typeof Headers>[0];
type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never;

type RequiredKeys<T> = T extends object
  ? {
      [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
    }[keyof T]
  : never;

type TrimLeadingSlash<TPath extends string> = TPath extends `/${infer TRest}`
  ? TrimLeadingSlash<TRest>
  : TPath;

type TrimTrailingSlash<TPath extends string> = TPath extends `${infer TRest}/`
  ? TrimTrailingSlash<TRest>
  : TPath;

type NormalizePathPart<TPath extends string> = TrimLeadingSlash<
  TrimTrailingSlash<TPath>
>;

type EscapeClientSegment<TSegment extends string> = TSegment extends `$${string}`
  ? `$${TSegment}`
  : TSegment;

type SplitPathSegments<TPath extends string> = NormalizePathPart<TPath> extends infer TNormalized extends string
  ? TNormalized extends ""
    ? []
    : TNormalized extends `${infer THead}/${infer TTail}`
      ? [EscapeClientSegment<THead>, ...SplitPathSegments<TTail>]
      : [EscapeClientSegment<TNormalized>]
  : never;

type MethodHelperName<TMethod extends HttpMethod> = TMethod extends "GET"
  ? "$get"
  : TMethod extends "POST"
    ? "$post"
    : TMethod extends "PUT"
      ? "$put"
      : TMethod extends "PATCH"
        ? "$patch"
        : "$delete";

type OptionalArgs<TArg extends object> = [RequiredKeys<TArg>] extends [never]
  ? [args?: TArg]
  : [args: TArg];

type OptionalMethodArgs<
  TArg extends object,
  TOverride extends object,
> = [RequiredKeys<TArg>] extends [never]
  ? [] | [args: TArg] | [args: TArg | undefined, overrides: TOverride]
  : [args: TArg] | [args: TArg, overrides: TOverride];

type ResponseStatus<TResponses extends Record<number, unknown>> = Extract<
  keyof TResponses,
  number
>;

type RouteMethod<TRoute> = TRoute extends {
  method: infer TMethod extends HttpMethod;
}
  ? TMethod
  : never;

type RouteFullPath<TRoute> = TRoute extends {
  fullPath: infer TPath extends string;
}
  ? TPath
  : never;

type RouteRequestSpec<TRoute> = TRoute extends {
  request?: infer TRequest extends HttpRequestSpec;
}
  ? TRequest
  : undefined;

type RouteResponses<TRoute> = TRoute extends {
  responses: infer TResponses extends Record<number, unknown>;
}
  ? TResponses
  : Record<number, unknown>;

type NormalizeDeclaredErrors<TErrors> = TErrors extends RouteErrorsConfig
  ? string extends keyof TErrors
    ? {}
    : TErrors
  : {};

type RouteDeclaredErrors<TRoute> = NormalizeDeclaredErrors<
  Exclude<TRoute extends { errors?: infer TErrors } ? TErrors : undefined, undefined>
>;

type RequestObjectSectionInput<
  TRequest extends HttpRequestSpec | undefined,
  TKey extends "params" | "query" | "headers" | "cookies",
> = TRequest extends {
  [K in TKey]?: infer TSchema extends z.ZodTypeAny;
}
  ? z.input<TSchema>
  : Record<string, never>;

type RequestBodyInput<TRequest extends HttpRequestSpec | undefined> =
  TRequest extends {
    body?: infer TBody;
  }
    ? TBody extends HttpRequestBodyDescriptor<infer TSchema, any>
      ? z.input<TSchema>
      : TBody extends z.ZodTypeAny
        ? z.input<TBody>
        : undefined
    : undefined;

type HasObjectSection<TValue> = TValue extends object
  ? keyof TValue extends never
    ? false
    : true
  : false;

type HasRequiredObjectSection<TValue> = TValue extends object
  ? [RequiredKeys<TValue>] extends [never]
    ? false
    : true
  : false;

type HasBody<TValue> = [Exclude<TValue, undefined>] extends [never] ? false : true;

type HasRequiredBody<TValue> = [Exclude<TValue, undefined>] extends [never]
  ? false
  : undefined extends TValue
    ? false
    : true;

type ParamOption<TValue> = HasObjectSection<TValue> extends true
  ? HasRequiredObjectSection<TValue> extends true
    ? { params: TValue; param?: TValue } | { param: TValue; params?: TValue }
    : { params?: TValue; param?: TValue }
  : {};

type QueryOption<TValue> = HasObjectSection<TValue> extends true
  ? HasRequiredObjectSection<TValue> extends true
    ? { query: TValue }
    : { query?: TValue }
  : {};

type HeadersOption<TValue> = HasObjectSection<TValue> extends true
  ? HasRequiredObjectSection<TValue> extends true
    ? { headers: TValue }
    : { headers?: TValue }
  : {};

type CookiesOption<TValue> = HasObjectSection<TValue> extends true
  ? HasRequiredObjectSection<TValue> extends true
    ? { cookies: TValue }
    : { cookies?: TValue }
  : {};

type JsonOption<TValue> = HasBody<TValue> extends true
  ? HasRequiredBody<TValue> extends true
    ? { json: TValue }
    : { json?: TValue }
  : {};

type FormDataOption<TValue> = HasBody<TValue> extends true
  ? HasRequiredBody<TValue> extends true
    ? { formData: TValue }
    : { formData?: TValue }
  : {};

type FormOption<TValue> = HasBody<TValue> extends true
  ? HasRequiredBody<TValue> extends true
    ? { form: TValue }
    : { form?: TValue }
  : {};

type TextOption<TValue> = HasBody<TValue> extends true
  ? HasRequiredBody<TValue> extends true
    ? { text: TValue }
    : { text?: TValue }
  : {};

type BinaryOption<TValue> = HasBody<TValue> extends true
  ? HasRequiredBody<TValue> extends true
    ? { binary: TValue }
    : { binary?: TValue }
  : {};

type RequestInitOption = {
  init?: Omit<RequestInit, "body" | "headers" | "method">;
};

type ApiMethodOverride = {
  headers?: RequestHeadersInit;
  init?: Omit<RequestInit, "body" | "headers" | "method">;
};

type BodyOptions<TRequest extends HttpRequestSpec | undefined> =
  RouteRequestBody<TRoutePlaceholder<TRequest>> extends infer TBody
    ? RouteRequestBodyKind<TRoutePlaceholder<TRequest>> extends "formData"
      ? FormDataOption<TBody>
      : RouteRequestBodyKind<TRoutePlaceholder<TRequest>> extends "urlEncoded"
        ? FormOption<TBody>
        : RouteRequestBodyKind<TRoutePlaceholder<TRequest>> extends "text"
          ? TextOption<TBody>
          : RouteRequestBodyKind<TRoutePlaceholder<TRequest>> extends "binary"
            ? BinaryOption<TBody>
            : JsonOption<TBody>
    : {};

type TRoutePlaceholder<TRequest extends HttpRequestSpec | undefined> = {
  request?: TRequest;
};

type RouteRequestBody<TRoute> = RequestBodyInput<RouteRequestSpec<TRoute>>;

type RouteRequestBodyKind<TRoute> =
  RouteRequestSpec<TRoute> extends {
    body?: infer TBody;
  }
    ? TBody extends {
        kind: infer TKind extends string;
      }
      ? TKind
      : "json"
    : never;

type RouteRequestOptions<TRoute> = Simplify<
  ParamOption<RequestObjectSectionInput<RouteRequestSpec<TRoute>, "params">> &
    QueryOption<RequestObjectSectionInput<RouteRequestSpec<TRoute>, "query">> &
    HeadersOption<RequestObjectSectionInput<RouteRequestSpec<TRoute>, "headers">> &
    CookiesOption<RequestObjectSectionInput<RouteRequestSpec<TRoute>, "cookies">> &
    BodyOptions<RouteRequestSpec<TRoute>> &
    RequestInitOption
>;

type RouteUrlOptions<TRoute> = Simplify<
  ParamOption<RequestObjectSectionInput<RouteRequestSpec<TRoute>, "params">> &
    QueryOption<RequestObjectSectionInput<RouteRequestSpec<TRoute>, "query">>
>;

type ErrorBody<
  TCode extends string,
  TDetails = undefined,
> = [TDetails] extends [undefined]
  ? {
      error: {
        code: TCode;
        message: string;
        details?: undefined;
      };
    }
  : {
      error: {
        code: TCode;
        message: string;
        details?: TDetails;
      };
    };

type ExplicitErrorEntry<
  TDescriptor extends HttpErrorDescriptor<any, any, any>,
> = {
  status: TDescriptor["status"];
  body: ErrorBody<
    TDescriptor["code"],
    NonNullable<TDescriptor["details"]> extends z.ZodTypeAny
      ? z.output<NonNullable<TDescriptor["details"]>>
      : undefined
  >;
};

type ExplicitErrorEntries<TRoute> = {
  [TCode in keyof RouteDeclaredErrors<TRoute> &
    string]: RouteDeclaredErrors<TRoute>[TCode] extends infer TDescriptor extends HttpErrorDescriptor<
    any,
    any,
    any
  >
    ? ExplicitErrorEntry<TDescriptor>
    : never;
}[keyof RouteDeclaredErrors<TRoute> & string];

type ImplicitErrorEntries<TMethod extends HttpMethod> =
  | {
      status: 400;
      body: ErrorBody<"BEDROCK_VALIDATION_ERROR", unknown>;
    }
  | {
      status: 500;
      body:
        | ErrorBody<"BEDROCK_HTTP_INTERNAL_ERROR", unknown>
        | ErrorBody<"BEDROCK_HTTP_ROUTE_CONTRACT_ERROR", unknown>;
    }
  | (TMethod extends "GET"
      ? never
      : {
          status: 415;
          body: ErrorBody<"BEDROCK_HTTP_UNSUPPORTED_MEDIA_TYPE", unknown>;
        });

type ResponseEntriesToMap<
  TEntries extends {
    status: number;
    body: unknown;
  },
> = {
  [TStatus in TEntries["status"]]: Extract<TEntries, { status: TStatus }>["body"];
};

type SuccessResponseBody<TResponse> =
  TResponse extends HttpResponseDescriptor<infer TSchema, infer TKind>
    ? TKind extends "text"
      ? string
      : TKind extends "binary"
        ? Uint8Array
        : TKind extends "json"
          ? z.output<TSchema>
          : Response
    : TResponse extends z.ZodTypeAny
      ? z.output<TResponse>
      : unknown;

type SuccessResponseEntries<TRoute> = {
  [TStatus in keyof RouteResponses<TRoute> &
    number]: {
    status: TStatus;
    body: SuccessResponseBody<RouteResponses<TRoute>[TStatus]>;
  };
}[keyof RouteResponses<TRoute> & number];

type RouteResponseEntries<TRoute> =
  | SuccessResponseEntries<TRoute>
  | ExplicitErrorEntries<TRoute>
  | ImplicitErrorEntries<RouteMethod<TRoute>>;

type RouteResponseMap<TRoute> = ResponseEntriesToMap<RouteResponseEntries<TRoute>>;

type ApiMethod<
  TRequest extends object,
  TResponses extends Record<number, unknown>,
> = (
  ...args: OptionalMethodArgs<TRequest, ApiMethodOverride>
) => Promise<ApiClientResponse<TResponses>>;

type ApiUrlBuilder<TRequest extends object> = (
  ...args: OptionalArgs<TRequest>
) => URL;

type ApiPathBuilder<TRequest extends object> = (
  ...args: OptionalArgs<TRequest>
) => string;

type RouteClientLeaf<TRoute> = {
  [TMethodName in MethodHelperName<RouteMethod<TRoute>>]: ApiMethod<
    RouteRequestOptions<TRoute>,
    RouteResponseMap<TRoute>
  >;
} & {
  $url: ApiUrlBuilder<RouteUrlOptions<TRoute>>;
  $path: ApiPathBuilder<RouteUrlOptions<TRoute>>;
};

type BuildPathTree<
  TSegments extends readonly string[],
  TLeaf,
> = TSegments extends readonly [
  infer THead extends string,
  ...infer TRest extends string[],
]
  ? {
      [TSegment in THead]: BuildPathTree<TRest, TLeaf>;
    }
  : TLeaf;

type RouteClientTree<TRoute> = TRoute extends HttpRouteContract<
  HttpMethod,
  string,
  HttpRequestSpec | undefined,
  HttpSuccessResponses,
  RouteErrorsConfig
>
  ? BuildPathTree<
      SplitPathSegments<RouteFullPath<TRoute>>,
      RouteClientLeaf<TRoute>
    >
  : never;

type MergeRouteTreeUnion<TTree> = [TTree] extends [never]
  ? {}
  : Simplify<UnionToIntersection<TTree>>;

export type ApiClientResponse<
  TResponses extends Record<number, unknown>,
> = Response & {
  readonly __bedrockResponses?: TResponses;
  status: ResponseStatus<TResponses>;
};

export type ApiContract<TApp extends AppDescriptor> =
  MergeRouteTreeUnion<RouteClientTree<AppRouteContracts<TApp>>>;

export type ApiClient<TContract> = TContract;

export type InferRequestType<TEndpoint> = TEndpoint extends (
  ...args: infer TArgs
) => unknown
  ? Exclude<TArgs[0], undefined>
  : never;

export type InferResponseType<
  TEndpoint,
  TStatus = undefined,
> = TEndpoint extends (...args: any[]) => Promise<infer TResponse>
  ? TResponse extends {
      __bedrockResponses?: infer TResponses extends Record<number, unknown>;
    }
    ? [TStatus] extends [undefined]
      ? TResponses
      : Extract<TResponses[Extract<TStatus, keyof TResponses>], unknown>
    : never
  : never;

type HttpOkStatus = 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226;

type SuccessfulStatuses<TResponses extends Record<number, unknown>> = Extract<
  keyof TResponses,
  HttpOkStatus
>;

type SuccessfulBodies<TResponses extends Record<number, unknown>> = TResponses[SuccessfulStatuses<TResponses>];
type FailedStatuses<TResponses extends Record<number, unknown>> = Exclude<
  keyof TResponses,
  HttpOkStatus
>;
type FailedBodies<TResponses extends Record<number, unknown>> = TResponses[FailedStatuses<TResponses>];

export type InferParsedResponseType<TResponse> = TResponse extends {
  __bedrockResponses?: infer TResponses extends Record<number, unknown>;
}
  ? SuccessfulBodies<TResponses>
  : unknown;

export type InferErrorResponseType<TResponse> = TResponse extends {
  __bedrockResponses?: infer TResponses extends Record<number, unknown>;
}
  ? FailedBodies<TResponses>
  : never;
