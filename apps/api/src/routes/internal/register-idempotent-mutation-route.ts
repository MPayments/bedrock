import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";

import type { ResourcePermissions } from "../../auth";
import { handleRouteError } from "../../common/errors";
import { jsonOk } from "../../common/response";
import type { AuthVariables } from "../../middleware/auth";
import {
  getRequestContext,
  withRequiredIdempotency,
} from "../../middleware/idempotency";
import { requirePermission } from "../../middleware/permission";

type MutationContext = Context<{ Variables: AuthVariables }>;

type MutationMethod = "post" | "patch";

type MutationJsonOptions = {
  normalizeMoney?: boolean;
};

interface RegisterIdempotentMutationRouteConfig<TBody, TResult> {
  app: OpenAPIHono<{ Variables: AuthVariables }>;
  method?: MutationMethod;
  path: string;
  permission: ResourcePermissions;
  parseBody?: (c: MutationContext) => Promise<TBody> | TBody;
  handle: (input: {
    c: MutationContext;
    body: TBody;
    actorUserId: string;
    idempotencyKey: string;
    requestContext: ReturnType<typeof getRequestContext>;
  }) => Promise<TResult>;
  respond?: (c: MutationContext, result: TResult) => Response;
  status?: number;
  jsonOptions?: MutationJsonOptions;
  handleError?: (c: MutationContext, error: unknown) => Response;
}

export function registerIdempotentMutationRoute<TBody = void, TResult = unknown>(
  config: RegisterIdempotentMutationRouteConfig<TBody, TResult>,
) {
  const method = config.method ?? "post";
  const register =
    method === "patch"
      ? config.app.patch.bind(config.app)
      : config.app.post.bind(config.app);

  register(
    config.path,
    requirePermission(config.permission),
    async (c: MutationContext) => {
      try {
        const body = config.parseBody
          ? await config.parseBody(c)
          : (undefined as TBody);

        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          config.handle({
            c,
            body,
            actorUserId: c.get("user")!.id,
            idempotencyKey,
            requestContext: getRequestContext(c),
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        if (config.respond) {
          return config.respond(c, result);
        }

        return jsonOk(c, result, config.status ?? 200, config.jsonOptions);
      } catch (error) {
        const routeErrorHandler = config.handleError ?? handleRouteError;
        return routeErrorHandler(c as any, error);
      }
    },
  );
}
