import type { HttpMethod } from "./controller";
import type { HttpRequestSpec, HttpSuccessResponses } from "./http";
import type { RouteErrorsConfig } from "./route-errors";
import type { AppDescriptor } from "./runtime/types";

type IsBroadString<TValue> = TValue extends string
  ? string extends TValue
    ? true
    : false
  : true;

type IsBroadModule<TModule> = TModule extends {
  name: infer TName extends string;
}
  ? IsBroadString<TName>
  : true;

type IsBroadController<TController> = TController extends {
  name: infer TName extends string;
}
  ? IsBroadString<TName>
  : true;

type TrimLeadingSlash<TPath extends string> = TPath extends `/${infer TRest}`
  ? TrimLeadingSlash<TRest>
  : TPath;

type TrimTrailingSlash<TPath extends string> = TPath extends `${infer TRest}/`
  ? TrimTrailingSlash<TRest>
  : TPath;

type NormalizePathPart<TPath extends string> = TrimLeadingSlash<
  TrimTrailingSlash<TPath>
>;

type JoinPath<
  TLeft extends string | undefined,
  TRight extends string,
> = NormalizePathPart<TLeft extends string ? TLeft : ""> extends infer TNormalizedLeft extends string
  ? NormalizePathPart<TRight> extends infer TNormalizedRight extends string
    ? TNormalizedLeft extends ""
      ? TNormalizedRight extends ""
        ? "/"
        : `/${TNormalizedRight}`
      : TNormalizedRight extends ""
        ? `/${TNormalizedLeft}`
        : `/${TNormalizedLeft}/${TNormalizedRight}`
    : never
  : never;

type NormalizeBasePath<TBasePath> = [Exclude<TBasePath, undefined>] extends [never]
  ? undefined
  : Exclude<TBasePath, undefined> & string;

type ControllerBasePath<TController> = TController extends {
  basePath?: infer TBasePath;
}
  ? NormalizeBasePath<TBasePath>
  : undefined;

type ModuleImportList<TModule> = Exclude<
  TModule extends {
    imports?: infer TImports;
  }
    ? TImports
    : never,
  undefined
> extends infer TImports
  ? TImports extends readonly unknown[]
    ? TImports
    : readonly []
  : never;

type RouteMethod<TRoute> = TRoute extends {
  method: infer TMethod extends HttpMethod;
}
  ? TMethod
  : never;

type RoutePath<TRoute> = TRoute extends {
  path: infer TPath extends string;
}
  ? TPath
  : never;

type RouteRequestSpec<TRoute> = TRoute extends {
  request?: infer TRequest extends HttpRequestSpec;
}
  ? TRequest
  : undefined;

type RouteResponses<TRoute> = TRoute extends {
  responses: infer TResponses extends HttpSuccessResponses;
}
  ? TResponses
  : HttpSuccessResponses;

type RouteDeclaredErrors<TRoute> = TRoute extends {
  errors?: infer TErrors extends RouteErrorsConfig;
}
  ? TErrors
  : {};

export type HttpRouteContract<
  TMethod extends HttpMethod = HttpMethod,
  TFullPath extends string = string,
  TRequest extends HttpRequestSpec | undefined = HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
  TErrors extends RouteErrorsConfig = RouteErrorsConfig,
> = {
  method: TMethod;
  fullPath: TFullPath;
  request: TRequest;
  responses: TResponses;
  errors: TErrors;
};

type ControllerRouteContracts<TController> = TController extends {
  routes: infer TRoutes extends object;
}
  ? {
      [TRouteName in keyof TRoutes & string]: TRoutes[TRouteName] extends infer TRoute extends {
        method: HttpMethod;
        path: string;
        responses: HttpSuccessResponses;
      }
        ? HttpRouteContract<
            RouteMethod<TRoute>,
            JoinPath<ControllerBasePath<TController>, RoutePath<TRoute>>,
            RouteRequestSpec<TRoute>,
            RouteResponses<TRoute>,
            RouteDeclaredErrors<TRoute>
          >
        : never;
    }[keyof TRoutes & string]
  : never;

type ControllerRouteContractsFromControllers<TControllers> = Exclude<
  TControllers,
  undefined
> extends infer TControllersValue
  ? TControllersValue extends readonly unknown[]
    ? TControllersValue[number] extends infer TController
      ? IsBroadController<TController> extends true
        ? never
        : ControllerRouteContracts<TController>
      : never
    : never
  : never;

type ModuleRouteContracts<
  TModules extends readonly unknown[],
  TVisited = never,
> = TModules[number] extends infer TModule
  ? IsBroadModule<TModule> extends true
    ? never
    : TModule extends TVisited
      ? never
      : ControllerRouteContractsFromControllers<
            TModule extends {
              controllers?: infer TControllers;
            }
              ? TControllers
              : never
          > | ModuleRouteContracts<ModuleImportList<TModule>, TVisited | TModule>
  : never;

export type AppRouteContracts<TApp extends AppDescriptor> = TApp extends {
  modules: infer TModules extends readonly unknown[];
}
  ? ModuleRouteContracts<TModules>
  : never;
