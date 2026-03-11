import {
  type BivariantCallback,
  type ErrorResult,
  type HttpErrorDescriptor,
  type HttpErrorInstance,
  type InferErrorDetails,
  type MaybePromise,
  type Phantom,
  type Simplify,
} from "@bedrock/common";
import { z } from "zod";

import {
  cloneReadonlyArray,
  cloneReadonlyRecord,
  freezeObject,
} from "./immutability";
import type {
  ReservedLoggerContextGuard,
  ReservedLoggerDepGuard,
  WithAmbientLogger,
} from "./descriptor-types";
import type {
  HttpRequestBodyDescriptor,
  HttpRequestData,
  HttpRequestSpec,
  HttpRouteOutput,
  HttpSuccessResponses,
  InferFiniteHttpResponseValue,
} from "./http";
import type { ResolveTokenMap, TokenMap } from "./kernel";
import type { ControllerMiddlewareDescriptor } from "./middleware";
import type { RouteErrorsConfig } from "./route-errors";
import {
  isNoInputSchema,
  type InferActionInput,
  type InferActionOutput,
  type ServiceActionHandle,
} from "./service";

type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never;

type NormalizeRouteErrors<T> = T extends RouteErrorsConfig ? T : {};

type MiddlewareErrorMap<TMiddleware> =
  TMiddleware extends ControllerMiddlewareDescriptor<any, any, any, infer TErrors>
    ? TErrors
    : {};

type MergeMiddlewareErrorMaps<
  TMiddlewares extends
    | readonly ControllerMiddlewareDescriptor<any, any, any, any>[]
    | undefined,
> = [TMiddlewares] extends [
  readonly ControllerMiddlewareDescriptor<any, any, any, any>[],
]
  ? Simplify<UnionToIntersection<MiddlewareErrorMap<TMiddlewares[number]>>>
  : {};

type EffectiveRouteErrors<
  TRouteErrors extends RouteErrorsConfig | undefined,
  TMiddlewares extends
    | readonly ControllerMiddlewareDescriptor<any, any, any, any>[]
    | undefined,
> = Simplify<
  NormalizeRouteErrors<TRouteErrors> & MergeMiddlewareErrorMaps<TMiddlewares>
>;

type HttpErrorDescriptorUnion<TErrors extends RouteErrorsConfig> =
  TErrors[Extract<keyof TErrors, string>] extends infer TDescriptor
    ? TDescriptor extends HttpErrorDescriptor
      ? TDescriptor
      : never
    : never;

type InferHttpErrorUnion<TErrors extends RouteErrorsConfig> =
  HttpErrorDescriptorUnion<TErrors> extends infer TDescriptor
    ? TDescriptor extends HttpErrorDescriptor
      ? HttpErrorInstance<TDescriptor>
      : never
    : never;

type ControllerError<TErrors extends RouteErrorsConfig> = <
  TDescriptor extends HttpErrorDescriptorUnion<TErrors>,
>(
  descriptor: TDescriptor,
  details?: InferErrorDetails<TDescriptor>,
) => ErrorResult<HttpErrorInstance<TDescriptor>>;

type ActionErrorCodes<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
> = Extract<TAction["errors"][number]["code"], string>;

type MissingActionMappings<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
  TErrors extends RouteErrorsConfig,
> = Exclude<ActionErrorCodes<TAction>, Extract<keyof TErrors, string>>;

type CoveredAction<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
  TErrors extends RouteErrorsConfig,
> = [MissingActionMappings<TAction, TErrors>] extends [never]
  ? TAction
  : TAction & {
      __missing_route_error_mappings__: MissingActionMappings<TAction, TErrors>;
    };

type EnsureRouteLocalMappings<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
  TErrors extends RouteErrorsConfig,
> = [MissingActionMappings<TAction, TErrors>] extends [never]
  ? TErrors
  : TErrors & {
      __missing_route_error_mappings__: MissingActionMappings<TAction, TErrors>;
    };

type RequestParams<TRequest extends HttpRequestSpec | undefined> =
  TRequest extends {
    params?: infer TSchema extends z.ZodTypeAny;
  }
    ? z.output<TSchema>
    : Record<string, never>;

type RequestQuery<TRequest extends HttpRequestSpec | undefined> =
  TRequest extends {
    query?: infer TSchema extends z.ZodTypeAny;
  }
    ? z.output<TSchema>
    : Record<string, never>;

type RequestHeaders<TRequest extends HttpRequestSpec | undefined> =
  TRequest extends {
    headers?: infer TSchema extends z.ZodTypeAny;
  }
    ? z.output<TSchema>
    : Record<string, never>;

type RequestCookies<TRequest extends HttpRequestSpec | undefined> =
  TRequest extends {
    cookies?: infer TSchema extends z.ZodTypeAny;
  }
    ? z.output<TSchema>
    : Record<string, never>;

type RequestBody<TRequest extends HttpRequestSpec | undefined> =
  TRequest extends {
    body?: infer TBody;
  }
    ? TBody extends HttpRequestBodyDescriptor<infer TSchema, any>
      ? z.output<TSchema>
      : TBody extends z.ZodTypeAny
        ? z.output<TBody>
        : undefined
    : undefined;

type RequestSelectionSections<TRequest extends HttpRequestSpec | undefined> =
  | (TRequest extends { params?: infer TSchema extends z.ZodTypeAny } ? "params" : never)
  | (TRequest extends { query?: infer TSchema extends z.ZodTypeAny } ? "query" : never)
  | (TRequest extends { headers?: infer TSchema extends z.ZodTypeAny } ? "headers" : never)
  | (TRequest extends { cookies?: infer TSchema extends z.ZodTypeAny } ? "cookies" : never)
  | (TRequest extends { body?: infer TBody }
      ? TBody extends HttpRequestBodyDescriptor<any, any> | z.ZodTypeAny
        ? "body"
        : never
      : never);

export type ControllerRequestData<
  TRequest extends HttpRequestSpec | undefined = HttpRequestSpec | undefined,
> = {
  params: RequestParams<TRequest>;
  query: RequestQuery<TRequest>;
  headers: RequestHeaders<TRequest>;
  cookies: RequestCookies<TRequest>;
  body: RequestBody<TRequest>;
};

type IsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;

type SoleRouteStatus<TResponses extends HttpSuccessResponses> = Extract<
  keyof TResponses,
  number
>;

type BareRouteReturn<TResponses extends HttpSuccessResponses> =
  [SoleRouteStatus<TResponses>] extends [never]
    ? never
    : IsUnion<SoleRouteStatus<TResponses>> extends true
      ? never
      : InferFiniteHttpResponseValue<TResponses[SoleRouteStatus<TResponses>]>;

type ImplicitActionRouteSelectionKind<
  TRequest extends HttpRequestSpec | undefined,
> = [RequestSelectionSections<TRequest>] extends [never]
  ? "empty"
  : IsUnion<RequestSelectionSections<TRequest>> extends true
    ? never
    : RequestSelectionSections<TRequest>;

type ImplicitActionRouteInput<
  TRequest extends HttpRequestSpec | undefined,
  THandler extends ServiceActionHandle<any, any, any, any, any>,
> = ImplicitActionRouteSelectionKind<TRequest> extends infer TKind
  ? TKind extends "body"
    ? RequestBody<TRequest>
    : TKind extends "query"
      ? RequestQuery<TRequest>
      : TKind extends "params"
        ? RequestParams<TRequest>
        : TKind extends "headers"
          ? RequestHeaders<TRequest>
          : TKind extends "cookies"
            ? RequestCookies<TRequest>
            : TKind extends "empty"
              ? THandler["input"] extends z.ZodUndefined
                ? undefined
                : Record<string, never>
              : never
  : never;

type ActionRouteSelectField<
  TRequest extends HttpRequestSpec | undefined,
  THandler extends ServiceActionHandle<any, any, any, any, any>,
> = [HttpRequestSpec] extends [Exclude<TRequest, undefined>]
  ? {
      select?: (request: ControllerRequestData<TRequest>) => InferActionInput<THandler>;
    }
  : [ImplicitActionRouteSelectionKind<TRequest>] extends [never]
  ? {
      select: (request: ControllerRequestData<TRequest>) => InferActionInput<THandler>;
    }
  : ImplicitActionRouteInput<TRequest, THandler> extends InferActionInput<THandler>
    ? {
        select?: (request: ControllerRequestData<TRequest>) => InferActionInput<THandler>;
      }
    : {
        select: (request: ControllerRequestData<TRequest>) => InferActionInput<THandler>;
      };

type RouteMetadata = {
  summary?: string;
  description?: string;
  tags?: readonly string[];
};

type PublicCustomRouteHandler = BivariantCallback<any, MaybePromise<unknown>>;

type ActionRouteErrorsField<
  THandler extends ServiceActionHandle<any, any, any, any, any>,
  TErrors extends RouteErrorsConfig,
> = ActionErrorCodes<THandler> extends never
  ? {
      errors?: TErrors;
    }
  : {
      errors: EnsureRouteLocalMappings<THandler, TErrors>;
    };

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ControllerCall<TErrors extends RouteErrorsConfig = {}> = {
  <const TAction extends ServiceActionHandle<any, any, any, any, any>>(
    ...args: TAction["input"] extends z.ZodUndefined
      ? [action: CoveredAction<TAction, TErrors>, input?: never]
      : [action: CoveredAction<TAction, TErrors>, input: InferActionInput<TAction>]
  ): Promise<InferActionOutput<TAction>>;
};

export type ControllerHandlerTools<
  TErrors extends RouteErrorsConfig = {},
> = {
  call: ControllerCall<TErrors>;
  error: ControllerError<TErrors>;
};

export type ControllerContextTools = {
  call: ControllerCall<any>;
};

export type ControllerRouteHandlerArgs<
  TCtx,
  TRequest extends HttpRequestSpec | undefined = undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
  TErrors extends RouteErrorsConfig = {},
> = {
  ctx: WithAmbientLogger<TCtx>;
  request: ControllerRequestData<TRequest>;
  params: ControllerRequestData<TRequest>["params"];
  query: ControllerRequestData<TRequest>["query"];
  headers: ControllerRequestData<TRequest>["headers"];
  cookies: ControllerRequestData<TRequest>["cookies"];
  body: ControllerRequestData<TRequest>["body"];
} & ControllerHandlerTools<TErrors>;

export type ControllerRouteMiddlewareArgs<
  TCtx,
  TRequest extends HttpRequestSpec | undefined = undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
  TErrors extends RouteErrorsConfig = {},
> = ControllerRouteHandlerArgs<TCtx, TRequest, TResponses, TErrors> & {
  next: () => Promise<
    | BareRouteReturn<TResponses>
    | HttpRouteOutput<TResponses>
    | ErrorResult<InferHttpErrorUnion<TErrors>>
  >;
};

export type CustomRouteDef<
  TCtx,
  TRequest extends HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses,
  TRouteErrors extends RouteErrorsConfig = {},
  TMiddlewares extends
    readonly ControllerMiddlewareDescriptor<any, any, any, any>[] = readonly [],
  TMethod extends HttpMethod = HttpMethod,
  TPath extends string = string,
> = RouteMetadata & {
  errors?: TRouteErrors;
  kind: "route";
  method: TMethod;
  path: TPath;
  request?: TRequest;
  responses: TResponses;
  handler: PublicCustomRouteHandler;
  middleware?: readonly [...TMiddlewares];
  select?: never;
} & Phantom<[TCtx]>;

export type ServiceActionRouteDef<
  TCtx,
  TRequest extends HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses,
  THandler extends ServiceActionHandle<any, any, any, any, any>,
  TRouteErrors extends RouteErrorsConfig = {},
  TMiddlewares extends
    readonly ControllerMiddlewareDescriptor<any, any, any, any>[] = readonly [],
  TMethod extends HttpMethod = HttpMethod,
  TPath extends string = string,
> = RouteMetadata &
  Phantom<[TCtx]> &
  ActionRouteErrorsField<THandler, TRouteErrors> & {
    kind: "action-route";
    method: TMethod;
    path: TPath;
    request?: TRequest;
    responses: TResponses;
    handler: THandler;
    select?: (request: ControllerRequestData<TRequest>) => InferActionInput<THandler>;
    middleware?: readonly [...TMiddlewares];
  };

type CustomRouteConfig<
  TCtx,
  TPath extends string,
  TRequest extends HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses,
  TRouteErrors extends RouteErrorsConfig = {},
  TMiddlewares extends
    readonly ControllerMiddlewareDescriptor<any, any, any, any>[] = readonly [],
> = RouteMetadata & {
  path: TPath;
  request?: TRequest;
  responses: TResponses;
  errors?: TRouteErrors;
  handler: BivariantCallback<
    ControllerRouteHandlerArgs<
      TCtx,
      TRequest,
      TResponses,
      EffectiveRouteErrors<NoInfer<TRouteErrors>, NoInfer<TMiddlewares>>
    >,
    MaybePromise<
      | BareRouteReturn<TResponses>
      | HttpRouteOutput<TResponses>
      | ErrorResult<
          InferHttpErrorUnion<
            EffectiveRouteErrors<NoInfer<TRouteErrors>, NoInfer<TMiddlewares>>
          >
        >
    >
  >;
  middleware?: readonly [...TMiddlewares];
  select?: never;
};

type ActionRouteConfig<
  TCtx,
  TPath extends string,
  TRequest extends HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses,
  THandler extends ServiceActionHandle<any, any, any, any, any>,
  TRouteErrors extends RouteErrorsConfig = {},
  TMiddlewares extends
    readonly ControllerMiddlewareDescriptor<any, any, any, any>[] = readonly [],
> = RouteMetadata &
  ActionRouteErrorsField<THandler, TRouteErrors> &
  ActionRouteSelectField<TRequest, THandler> & {
    path: TPath;
    request?: TRequest;
    responses: TResponses;
    handler: THandler;
    middleware?: readonly [...TMiddlewares];
  };

export type AnyServiceActionRouteDef<
  TCtx = any,
  TMethod extends HttpMethod = HttpMethod,
  TPath extends string = string,
> = RouteMetadata & {
  kind: "action-route";
  method: TMethod;
  path: TPath;
  request?: HttpRequestSpec;
  responses: HttpSuccessResponses;
  handler: ServiceActionHandle<any, any, any, any, any>;
  select?: ((request: ControllerRequestData<any>) => any) | undefined;
  middleware?: readonly ControllerMiddlewareDescriptor<TCtx, any, any, any>[];
  errors?: RouteErrorsConfig;
};

export type AnyCustomRouteDef<
  TCtx = any,
  TMethod extends HttpMethod = HttpMethod,
  TPath extends string = string,
> = RouteMetadata & {
  kind: "route";
  method: TMethod;
  path: TPath;
  request?: HttpRequestSpec;
  responses: HttpSuccessResponses;
  handler: PublicCustomRouteHandler;
  middleware?: readonly ControllerMiddlewareDescriptor<TCtx, any, any, any>[];
  errors?: RouteErrorsConfig;
  select?: never;
};

export type ControllerRoute<TCtx = any> =
  | AnyCustomRouteDef<TCtx>
  | AnyServiceActionRouteDef<TCtx>;

export type RouteDef<
  TCtx,
  TRequest extends HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses,
> = CustomRouteDef<TCtx, TRequest, TResponses>;

export type ControllerRouteMethodBuilder<
  TCtx,
  TMethod extends HttpMethod,
> = {
  <
    const TPath extends string,
    const TRequest extends HttpRequestSpec | undefined = undefined,
    const TResponses extends HttpSuccessResponses = HttpSuccessResponses,
    const TRouteErrors extends RouteErrorsConfig = {},
    const TMiddlewares extends
      readonly ControllerMiddlewareDescriptor<any, any, any, any>[] = readonly [],
  >(
    def: CustomRouteConfig<
      TCtx,
      TPath,
      TRequest,
      TResponses,
      TRouteErrors,
      TMiddlewares
    >,
  ): CustomRouteDef<
    TCtx,
    TRequest,
    TResponses,
    TRouteErrors,
    TMiddlewares,
    TMethod,
    TPath
  >;
  <
    const TPath extends string,
    const TRequest extends HttpRequestSpec | undefined = undefined,
    const TResponses extends HttpSuccessResponses = HttpSuccessResponses,
    const THandler extends ServiceActionHandle<any, any, any, any, any> = ServiceActionHandle<
      any,
      any,
      any,
      any,
      any
    >,
    const TRouteErrors extends RouteErrorsConfig = {},
    const TMiddlewares extends
      readonly ControllerMiddlewareDescriptor<any, any, any, any>[] = readonly [],
  >(
    def: ActionRouteConfig<
      TCtx,
      TPath,
      TRequest,
      TResponses,
      THandler,
      TRouteErrors,
      TMiddlewares
    >,
  ): ServiceActionRouteDef<
    TCtx,
    TRequest,
    TResponses,
    THandler,
    TRouteErrors,
    TMiddlewares,
    TMethod,
    TPath
  >;
};

export type ControllerRouteBuilder<TCtx> = {
  get: ControllerRouteMethodBuilder<TCtx, "GET">;
  post: ControllerRouteMethodBuilder<TCtx, "POST">;
  put: ControllerRouteMethodBuilder<TCtx, "PUT">;
  patch: ControllerRouteMethodBuilder<TCtx, "PATCH">;
  delete: ControllerRouteMethodBuilder<TCtx, "DELETE">;
};

export type ControllerRouteTools<TCtx> = {
  route: ControllerRouteBuilder<TCtx>;
};

export type ControllerDescriptor<
  TName extends string,
  TDeps extends TokenMap,
  TCtx,
  TRoutes extends Record<string, ControllerRoute<TCtx>>,
  TBasePath extends string | undefined = string | undefined,
> = {
  kind: "controller";
  name: TName;
  basePath?: TBasePath;
  deps?: TDeps;
  ctx?: (
    deps: ResolveTokenMap<TDeps>,
    tools: ControllerContextTools,
  ) => TCtx & ReservedLoggerContextGuard;
  routes: TRoutes;
};

export type DefinedController<
  TName extends string = string,
  TDeps extends TokenMap = any,
  TCtx = any,
  TRoutes extends Record<string, ControllerRoute<TCtx>> = Record<
    string,
    ControllerRoute<TCtx>
  >,
  TBasePath extends string | undefined = string | undefined,
> = ControllerDescriptor<TName, TDeps, TCtx, TRoutes, TBasePath>;

export type ControllerDefinition<
  TDeps extends TokenMap,
  TCtx,
  TRoutes extends Record<string, ControllerRoute<TCtx>>,
  TBasePath extends string | undefined = string | undefined,
> = {
  basePath?: TBasePath;
  deps?: TDeps & ReservedLoggerDepGuard;
  ctx?: (
    deps: ResolveTokenMap<TDeps>,
    tools: ControllerContextTools,
  ) => TCtx & ReservedLoggerContextGuard;
  routes: (tools: ControllerRouteTools<TCtx>) => TRoutes;
};

type ControllerDefinitionWithContext<
  TDeps extends TokenMap,
  TCtx,
  TRoutes extends Record<string, ControllerRoute<TCtx>>,
  TBasePath extends string | undefined,
> = {
  basePath?: TBasePath;
  deps?: TDeps & ReservedLoggerDepGuard;
  ctx: (
    deps: ResolveTokenMap<TDeps>,
    tools: ControllerContextTools,
  ) => TCtx & ReservedLoggerContextGuard;
  routes: (tools: ControllerRouteTools<TCtx>) => TRoutes;
};

type ControllerDefinitionWithoutContext<
  TDeps extends TokenMap,
  TRoutes extends Record<string, ControllerRoute<ResolveTokenMap<TDeps>>>,
  TBasePath extends string | undefined,
> = {
  basePath?: TBasePath;
  deps?: TDeps & ReservedLoggerDepGuard;
  ctx?: undefined;
  routes: (tools: ControllerRouteTools<ResolveTokenMap<TDeps>>) => TRoutes;
};

export function defineController<
  TName extends string,
  TDeps extends TokenMap = {},
  TCtx = ResolveTokenMap<TDeps>,
  const TBasePath extends string | undefined = undefined,
  const TRoutes extends Record<string, ControllerRoute<TCtx>> = Record<
    string,
    ControllerRoute<TCtx>
  >,
>(
  name: TName,
  def: ControllerDefinitionWithContext<TDeps, TCtx, TRoutes, TBasePath>,
): DefinedController<TName, TDeps, TCtx, TRoutes, TBasePath>;

export function defineController<
  TName extends string,
  TDeps extends TokenMap = {},
  const TBasePath extends string | undefined = undefined,
  const TRoutes extends Record<string, ControllerRoute<ResolveTokenMap<TDeps>>> = Record<
    string,
    ControllerRoute<ResolveTokenMap<TDeps>>
  >,
>(
  name: TName,
  def: ControllerDefinitionWithoutContext<TDeps, TRoutes, TBasePath>,
): DefinedController<TName, TDeps, ResolveTokenMap<TDeps>, TRoutes, TBasePath>;

export function defineController<
  TName extends string,
  TDeps extends TokenMap = {},
  TCtx = ResolveTokenMap<TDeps>,
  const TBasePath extends string | undefined = undefined,
  const TRoutes extends Record<string, ControllerRoute<TCtx>> = Record<
    string,
    ControllerRoute<TCtx>
  >,
>(name: TName, def: ControllerDefinition<TDeps, TCtx, TRoutes, TBasePath>) {
  const route = createControllerRouteBuilder<TCtx>();
  const routes = freezeObject(def.routes({ route }));

  return freezeObject({
    kind: "controller",
    name,
    basePath: def.basePath,
    deps: cloneReadonlyRecord(def.deps),
    ctx: def.ctx,
    routes,
  } satisfies DefinedController<TName, TDeps, TCtx, TRoutes, TBasePath>);
}

export function isActionRoute(
  route: ControllerRoute<any>,
): route is AnyServiceActionRouteDef<any> {
  return route.kind === "action-route";
}

export function getImplicitActionRouteSelector(
  request: HttpRequestSpec | undefined,
  actionInputSchema?: z.ZodTypeAny,
):
  | ((
      input: ControllerRequestData<HttpRequestSpec | undefined>,
    ) => unknown)
  | undefined {
  const selectionKind = getImplicitActionRouteSelectionKind(request);

  switch (selectionKind) {
    case "body":
      return (input) => input.body;
    case "query":
      return (input) => input.query;
    case "params":
      return (input) => input.params;
    case "headers":
      return (input) => input.headers;
    case "cookies":
      return (input) => input.cookies;
    case "empty":
      return isNoInputSchema(actionInputSchema ?? z.object({}))
        ? () => undefined
        : () => ({});
    default:
      return undefined;
  }
}

type RuntimeImplicitActionRouteSelectionKind =
  | "body"
  | "query"
  | "params"
  | "headers"
  | "cookies"
  | "empty";

function getImplicitActionRouteSelectionKind(
  request: HttpRequestSpec | undefined,
): RuntimeImplicitActionRouteSelectionKind | undefined {
  if (!request) {
    return "empty";
  }

  const sections = [
    request.params ? "params" : undefined,
    request.query ? "query" : undefined,
    request.headers ? "headers" : undefined,
    request.cookies ? "cookies" : undefined,
    request.body ? "body" : undefined,
  ].filter((value): value is RuntimeImplicitActionRouteSelectionKind => value !== undefined);

  if (sections.length === 0) {
    return "empty";
  }

  return sections.length === 1 ? sections[0] : undefined;
}

function createControllerRouteBuilder<TCtx>(): ControllerRouteBuilder<TCtx> {
  return {
    get: createMethodRouteBuilder<TCtx, "GET">("GET"),
    post: createMethodRouteBuilder<TCtx, "POST">("POST"),
    put: createMethodRouteBuilder<TCtx, "PUT">("PUT"),
    patch: createMethodRouteBuilder<TCtx, "PATCH">("PATCH"),
    delete: createMethodRouteBuilder<TCtx, "DELETE">("DELETE"),
  };
}

function createMethodRouteBuilder<TCtx, TMethod extends HttpMethod>(
  method: TMethod,
): ControllerRouteMethodBuilder<TCtx, TMethod> {
  return ((
    def:
      | CustomRouteConfig<
          TCtx,
          string,
          HttpRequestSpec | undefined,
          HttpSuccessResponses,
          RouteErrorsConfig
        >
      | ActionRouteConfig<
          TCtx,
          string,
          HttpRequestSpec | undefined,
          HttpSuccessResponses,
          ServiceActionHandle<any, any, any, any, any>,
          RouteErrorsConfig
        >,
  ) => {
    if (isServiceActionHandle(def.handler)) {
      const select =
        def.select ?? getImplicitActionRouteSelector(def.request, def.handler.input);

      return freezeObject({
        ...def,
        kind: "action-route" as const,
        method,
        request: def.request,
        responses: cloneReadonlyRecord(def.responses),
        select,
        tags: cloneReadonlyArray(def.tags),
        errors: cloneRouteErrors(def.errors),
        middleware: cloneReadonlyArray(
          def.middleware as readonly unknown[] | undefined,
        ) as
          | readonly ControllerMiddlewareDescriptor<TCtx, any, any, any>[]
          | undefined,
      });
    }

    return freezeObject({
      ...def,
      kind: "route" as const,
      method,
      request: def.request,
      responses: cloneReadonlyRecord(def.responses),
      handler: def.handler as AnyCustomRouteDef<TCtx>["handler"],
      tags: cloneReadonlyArray(def.tags),
      errors: cloneRouteErrors(def.errors),
      middleware: cloneReadonlyArray(
        def.middleware as readonly unknown[] | undefined,
      ) as
        | readonly ControllerMiddlewareDescriptor<TCtx, any, any, any>[]
        | undefined,
    });
  }) as unknown as ControllerRouteMethodBuilder<TCtx, TMethod>;
}

function isServiceActionHandle(
  value: unknown,
): value is ServiceActionHandle<any, any, any, any, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "service-action"
  );
}

function cloneRouteErrors(
  errors: RouteErrorsConfig | undefined,
): RouteErrorsConfig | undefined {
  return cloneReadonlyRecord(errors);
}
