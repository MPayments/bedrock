import { OpenAPIHono, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";

import {
  ComponentDependencyViolationError,
  ComponentDisabledError,
  ComponentStateVersionConflictError,
  ImmutableComponentError,
  MixedDeployError,
  UnknownComponentError,
} from "@bedrock/component-runtime";
import { AppError } from "@bedrock/kernel";

import auth from "./auth";
import { createAppContext, type Env } from "./context";
import {
  authMiddleware,
  requireAuth,
  type AuthVariables,
} from "./middleware/auth";
import { createComponentGuard } from "./middleware/module-guard";
import { requestContextMiddleware } from "./middleware/request-context";
import {
  API_APPLICATION_COMPONENTS,
  type ApiApplicationComponent,
} from "./modules/registry";
import {
  accountingRoutes,
  accountProvidersRoutes,
  accountsRoutes,
  balancesRoutes,
  connectorsRoutes,
  counterpartiesRoutes,
  counterpartyGroupsRoutes,
  customersRoutes,
  currenciesRoutes,
  fxRatesRoutes,
  orchestrationRoutes,
  paymentsRoutes,
  reconciliationRoutes,
  systemComponentsRoutes,
} from "./routes";

const env: Env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  TB_ADDRESS: process.env.TB_ADDRESS!,
  TB_CLUSTER_ID: Number(process.env.TB_CLUSTER_ID!),
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL!,
  BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS!,
};

const ctx = createAppContext(env);
void ctx.componentRuntime.startBackgroundSync().catch((error: unknown) => {
  ctx.logger.warn("Failed to start component runtime background sync", {
    error: error instanceof Error ? error.message : String(error),
  });
});
void ctx.documentsService
  .validateAccountingSourceCoverage()
  .catch((error: unknown) => {
    ctx.logger.error("Active accounting pack is incompatible with document sources", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
    setImmediate(() => process.exit(1));
  });

const configuredAuthOrigins = env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const authAllowedOriginSet = new Set(configuredAuthOrigins);

const app = new OpenAPIHono<{ Variables: AuthVariables }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: "Validation error",
          details: z.flattenError(result.error),
        },
        400,
      );
    }
  },
});

app.onError((err, c) => {
  if (err instanceof ComponentDisabledError) {
    c.header("Retry-After", String(err.retryAfterSec));
    return c.json(
      {
        error: "Component disabled",
        code: "COMPONENT_DISABLED",
        componentId: err.componentId,
        scope: err.scope,
        effectiveState: err.effectiveState,
        dependencyChain: err.dependencyChain,
        retryAfterSec: err.retryAfterSec,
        reason: err.reason,
      },
      503,
    );
  }

  if (err instanceof UnknownComponentError) {
    return c.json({ error: err.message, code: "UNKNOWN_COMPONENT" }, 404);
  }

  if (err instanceof MixedDeployError) {
    return c.json(
      {
        error: err.message,
        code: "MIXED_DEPLOY",
        runtimeChecksum: err.runtimeChecksum,
        localChecksum: err.localChecksum,
      },
      409,
    );
  }

  if (err instanceof ComponentStateVersionConflictError) {
    return c.json(
      {
        error: err.message,
        code: "COMPONENT_STATE_VERSION_CONFLICT",
        componentId: err.componentId,
        scopeType: err.scopeType,
        scopeId: err.scopeId,
        expectedVersion: err.expectedVersion,
        actualVersion: err.actualVersion,
      },
      409,
    );
  }

  if (err instanceof ComponentDependencyViolationError) {
    return c.json(
      {
        error: err.message,
        code: "COMPONENT_DEPENDENCY_VIOLATION",
        componentId: err.componentId,
        dependencyComponentId: err.dependencyComponentId,
        scope: err.scope,
      },
      409,
    );
  }

  if (err instanceof ImmutableComponentError) {
    return c.json(
      {
        error: err.message,
        code: "IMMUTABLE_COMPONENT",
        componentId: err.componentId,
      },
      409,
    );
  }

  if (AppError.is(err)) {
    ctx.logger.warn("Application error", {
      code: err.code,
      message: err.message,
    });
    return c.json({ error: err.message, code: err.code }, 500);
  }

  ctx.logger.error("Unexpected error", {
    error: String(err),
    cause: err.cause ? String(err.cause) : undefined,
  });
  return c.json({ error: "Internal server error" }, 500);
});

app.use(
  "*",
  cors({
    origin: (origin) => (authAllowedOriginSet.has(origin) ? origin : undefined),
    allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Book-Id"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["set-cookie", "Retry-After"],
    credentials: true,
  }),
);

app.use(
  "*",
  csrf({
    origin: configuredAuthOrigins,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

app.use("*", authMiddleware());
app.use("*", requestContextMiddleware());
app.use("/v1/*", requireAuth());

app.get("/", (c) => {
  return c.json({ status: "ok", service: "ledger-api" });
});

function createGuardedRouter(component: ApiApplicationComponent) {
  const guarded = new OpenAPIHono<{ Variables: AuthVariables }>();
  if (component.guarded !== false) {
    guarded.use("*", createComponentGuard(ctx, component.id));
  }
  guarded.route("/", component.registerRoutes(ctx));
  return guarded;
}

function buildV1Router(guarded: boolean): OpenAPIHono<{ Variables: AuthVariables }> {
  const router = new OpenAPIHono<{ Variables: AuthVariables }>();

  for (const component of API_APPLICATION_COMPONENTS) {
    router.route(
      component.routePath,
      guarded ? createGuardedRouter(component) : component.registerRoutes(ctx),
    );
  }

  return router;
}

const TYPED_ROUTE_PATHS = [
  "/accounting",
  "/account-providers",
  "/accounts",
  "/balances",
  "/counterparties",
  "/counterparty-groups",
  "/customers",
  "/currencies",
  "/payments",
  "/connectors",
  "/orchestration",
  "/fx/rates",
  "/reconciliation",
  "/system/components",
] as const;

function assertTypedRouteCoverage() {
  const typedRoutePaths = [...TYPED_ROUTE_PATHS].sort();
  const componentRoutePaths = API_APPLICATION_COMPONENTS.map((component) =>
    component.routePath,
  ).sort();

  const hasMismatch =
    typedRoutePaths.length !== componentRoutePaths.length ||
    typedRoutePaths.some((path, index) => path !== componentRoutePaths[index]);
  if (hasMismatch) {
    throw new Error(
      `Typed API route mounts are out of sync with component registry. typed=${typedRoutePaths.join(",")} components=${componentRoutePaths.join(",")}`,
    );
  }
}

assertTypedRouteCoverage();

const typedV1 = new OpenAPIHono<{ Variables: AuthVariables }>()
  .route("/accounting", accountingRoutes(ctx))
  .route("/account-providers", accountProvidersRoutes(ctx))
  .route("/accounts", accountsRoutes(ctx))
  .route("/balances", balancesRoutes(ctx))
  .route("/counterparties", counterpartiesRoutes(ctx))
  .route("/counterparty-groups", counterpartyGroupsRoutes(ctx))
  .route("/customers", customersRoutes(ctx))
  .route("/currencies", currenciesRoutes(ctx))
  .route("/payments", paymentsRoutes(ctx))
  .route("/connectors", connectorsRoutes(ctx))
  .route("/orchestration", orchestrationRoutes(ctx))
  .route("/fx/rates", fxRatesRoutes(ctx))
  .route("/reconciliation", reconciliationRoutes(ctx))
  .route("/system/components", systemComponentsRoutes(ctx));

const typedRoutes = new OpenAPIHono<{ Variables: AuthVariables }>().route(
  "/v1",
  typedV1,
);

const v1 = buildV1Router(true);

app.route("/v1", v1);

const openApiInfo = {
  info: {
    title: "Bedrock API",
    version: "1.0.0",
    description: "Deterministic financial API",
  },
};

app.doc31("/api/open-api", (c) => ({
  openapi: "3.1.0",
  ...openApiInfo,
  servers: [
    {
      url: new URL(c.req.url).origin,
      description: "Current environment",
    },
  ],
}));

app.get(
  "/docs",
  Scalar({
    pageTitle: openApiInfo.info.title,
    sources: [
      { url: "/api/open-api", title: "Api" },
      { url: "/api/auth/open-api/generate-schema", title: "Auth" },
    ],
  }),
);

export { app };
export type AppType = typeof typedRoutes;
