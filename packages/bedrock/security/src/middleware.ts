import {
  defineMiddleware,
  type ControllerMiddlewareDescriptor,
  type HttpRequestSpec,
  type HttpSuccessResponses,
} from "@bedrock/core";

import type { AccessScopeRef } from "./actor";
import type { AuthContext } from "./auth-context";
import {
  ForbiddenHttpError,
  UnauthorizedHttpError,
} from "./errors";

type SelectAuth<TCtx> = (ctx: TCtx) => AuthContext;

type RequireActorErrors = {
  SECURITY_UNAUTHENTICATED: typeof UnauthorizedHttpError;
};

type RequirePermissionErrors = {
  SECURITY_UNAUTHENTICATED: typeof UnauthorizedHttpError;
  SECURITY_FORBIDDEN: typeof ForbiddenHttpError;
};

export function requireActorMiddleware<
  TCtx extends { auth: AuthContext },
  TRequest extends HttpRequestSpec | undefined = HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
>(): ControllerMiddlewareDescriptor<
  TCtx,
  TRequest,
  TResponses,
  RequireActorErrors
>;

export function requireActorMiddleware<
  TCtx,
  TRequest extends HttpRequestSpec | undefined = HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
>(
  options: {
    selectAuth(ctx: TCtx): AuthContext;
    name?: string;
  },
): ControllerMiddlewareDescriptor<
  TCtx,
  TRequest,
  TResponses,
  RequireActorErrors
>;

export function requireActorMiddleware<
  TCtx,
  TRequest extends HttpRequestSpec | undefined = HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
>(
  options?: {
    selectAuth?: SelectAuth<TCtx>;
    name?: string;
  },
): ControllerMiddlewareDescriptor<
  TCtx,
  TRequest,
  TResponses,
  RequireActorErrors
> {
  const selectAuth = options?.selectAuth ?? defaultSelectAuth;

  return defineMiddleware(options?.name ?? "security.require-actor", {
    errors: {
      SECURITY_UNAUTHENTICATED: UnauthorizedHttpError,
    },
    run: async ({ ctx, error, next }) => {
      const result = selectAuth(ctx as TCtx).requireActor();

      if (!result.ok) {
        return error(UnauthorizedHttpError);
      }

      return next();
    },
  });
}

export function requirePermissionMiddleware<
  TCtx extends { auth: AuthContext },
  TRequest extends HttpRequestSpec | undefined = HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
>(
  permission: string,
  scope?: AccessScopeRef,
): ControllerMiddlewareDescriptor<
  TCtx,
  TRequest,
  TResponses,
  RequirePermissionErrors
>;

export function requirePermissionMiddleware<
  TCtx extends { auth: AuthContext },
  TRequest extends HttpRequestSpec | undefined = HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
>(
  permission: string,
  options: {
    scope?: AccessScopeRef;
    name?: string;
  },
): ControllerMiddlewareDescriptor<
  TCtx,
  TRequest,
  TResponses,
  RequirePermissionErrors
>;

export function requirePermissionMiddleware<
  TCtx,
  TRequest extends HttpRequestSpec | undefined = HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
>(
  permission: string,
  options: {
    scope?: AccessScopeRef;
    selectAuth(ctx: TCtx): AuthContext;
    name?: string;
  },
): ControllerMiddlewareDescriptor<
  TCtx,
  TRequest,
  TResponses,
  RequirePermissionErrors
>;

export function requirePermissionMiddleware<
  TCtx,
  TRequest extends HttpRequestSpec | undefined = HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
>(
  permission: string,
  scopeOrOptions?:
    | AccessScopeRef
    | {
        scope?: AccessScopeRef;
        selectAuth?: SelectAuth<TCtx>;
        name?: string;
      },
): ControllerMiddlewareDescriptor<
  TCtx,
  TRequest,
  TResponses,
  RequirePermissionErrors
> {
  const options = isMiddlewareOptions(scopeOrOptions) ? scopeOrOptions : undefined;
  const scope = isAccessScopeRef(scopeOrOptions)
    ? scopeOrOptions
    : options?.scope;
  const selectAuth = options?.selectAuth ?? defaultSelectAuth;

  return defineMiddleware(options?.name ?? `security.require-permission:${permission}`, {
    errors: {
      SECURITY_UNAUTHENTICATED: UnauthorizedHttpError,
      SECURITY_FORBIDDEN: ForbiddenHttpError,
    },
    run: async ({ ctx, error, next }) => {
      const result = selectAuth(ctx as TCtx).requirePermission(permission, scope);

      if (!result.ok) {
        if (result.error.code === "SECURITY_UNAUTHENTICATED") {
          return error(UnauthorizedHttpError);
        }

        return error(ForbiddenHttpError, result.error.details);
      }

      return next();
    },
  });
}

function defaultSelectAuth<TCtx>(ctx: TCtx): AuthContext {
  return (ctx as { auth: AuthContext }).auth;
}

function isMiddlewareOptions<TCtx>(
  value:
    | AccessScopeRef
    | {
        scope?: AccessScopeRef;
        selectAuth?: SelectAuth<TCtx>;
        name?: string;
      }
    | undefined,
): value is {
  scope?: AccessScopeRef;
  selectAuth?: SelectAuth<TCtx>;
  name?: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    !("type" in value && "id" in value)
  );
}

function isAccessScopeRef(value: unknown): value is AccessScopeRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "id" in value
  );
}
