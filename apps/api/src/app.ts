import { OpenAPIHono, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";

import { AppError } from "@bedrock/kernel";
import {
  ImmutableModuleError,
  MixedDeployError,
  ModuleDependencyViolationError,
  ModuleDisabledError,
  ModuleStateVersionConflictError,
  UnknownModuleError,
} from "@bedrock/module-runtime";

import auth from "./auth";
import { createAppContext, type Env } from "./context";
import {
  authMiddleware,
  requireAuth,
  type AuthVariables,
} from "./middleware/auth";
import { createModuleGuard } from "./middleware/module-guard";
import { requestContextMiddleware } from "./middleware/request-context";
import {
  accountingModule,
  accountProvidersModule,
  accountsModule,
  balancesModule,
  connectorsModule,
  counterpartiesModule,
  counterpartyGroupsModule,
  currenciesModule,
  customersModule,
  fxRatesModule,
  orchestrationModule,
  paymentsModule,
  reconciliationModule,
  systemModulesModule,
  type ApiApplicationModule,
} from "./modules/registry";

const env: Env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  TB_ADDRESS: process.env.TB_ADDRESS!,
  TB_CLUSTER_ID: Number(process.env.TB_CLUSTER_ID!),
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL!,
  BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS!,
};

const ctx = createAppContext(env);
void ctx.moduleRuntime.startBackgroundSync().catch((error: unknown) => {
  ctx.logger.warn("Failed to start module runtime background sync", {
    error: error instanceof Error ? error.message : String(error),
  });
});

const configuredAuthOrigins = env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const authAllowedOriginSet = new Set(configuredAuthOrigins);

// Create OpenAPIHono app with default error handler
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

// Global error handler for non-validation errors
app.onError((err, c) => {
  if (err instanceof ModuleDisabledError) {
    c.header("Retry-After", String(err.retryAfterSec));
    return c.json(
      {
        error: "Module disabled",
        code: "MODULE_DISABLED",
        moduleId: err.moduleId,
        scope: err.scope,
        effectiveState: err.effectiveState,
        dependencyChain: err.dependencyChain,
        retryAfterSec: err.retryAfterSec,
        reason: err.reason,
      },
      503,
    );
  }

  if (err instanceof UnknownModuleError) {
    return c.json({ error: err.message, code: "UNKNOWN_MODULE" }, 404);
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

  if (err instanceof ModuleStateVersionConflictError) {
    return c.json(
      {
        error: err.message,
        code: "MODULE_STATE_VERSION_CONFLICT",
        moduleId: err.moduleId,
        scopeType: err.scopeType,
        scopeId: err.scopeId,
        expectedVersion: err.expectedVersion,
        actualVersion: err.actualVersion,
      },
      409,
    );
  }

  if (err instanceof ModuleDependencyViolationError) {
    return c.json(
      {
        error: err.message,
        code: "MODULE_DEPENDENCY_VIOLATION",
        moduleId: err.moduleId,
        dependencyModuleId: err.dependencyModuleId,
        scope: err.scope,
      },
      409,
    );
  }

  if (err instanceof ImmutableModuleError) {
    return c.json(
      {
        error: err.message,
        code: "IMMUTABLE_MODULE",
        moduleId: err.moduleId,
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

// Health check
app.get("/", (c) => {
  return c.json({ status: "ok", service: "ledger-api" });
});

// Typed route surface for API client generation.
const typedV1 = new OpenAPIHono<{ Variables: AuthVariables }>()
  .route(accountingModule.routePath, accountingModule.registerRoutes(ctx))
  .route(
    accountProvidersModule.routePath,
    accountProvidersModule.registerRoutes(ctx),
  )
  .route(accountsModule.routePath, accountsModule.registerRoutes(ctx))
  .route(balancesModule.routePath, balancesModule.registerRoutes(ctx))
  .route(
    counterpartiesModule.routePath,
    counterpartiesModule.registerRoutes(ctx),
  )
  .route(
    counterpartyGroupsModule.routePath,
    counterpartyGroupsModule.registerRoutes(ctx),
  )
  .route(customersModule.routePath, customersModule.registerRoutes(ctx))
  .route(currenciesModule.routePath, currenciesModule.registerRoutes(ctx))
  .route(paymentsModule.routePath, paymentsModule.registerRoutes(ctx))
  .route(connectorsModule.routePath, connectorsModule.registerRoutes(ctx))
  .route(
    orchestrationModule.routePath,
    orchestrationModule.registerRoutes(ctx),
  )
  .route(fxRatesModule.routePath, fxRatesModule.registerRoutes(ctx))
  .route(
    reconciliationModule.routePath,
    reconciliationModule.registerRoutes(ctx),
  )
  .route(
    systemModulesModule.routePath,
    systemModulesModule.registerRoutes(ctx),
  );

const typedRoutes = new OpenAPIHono<{ Variables: AuthVariables }>().route(
  "/v1",
  typedV1,
);

// Mount routes under /v1 — modules are always mounted; enable/disable is guarded at execution time.
function createGuardedRouter(module: ApiApplicationModule) {
  const guarded = new OpenAPIHono<{ Variables: AuthVariables }>();
  if (module.guarded !== false) {
    guarded.use("*", createModuleGuard(ctx, module.id));
  }
  guarded.route("/", module.registerRoutes(ctx));
  return guarded;
}

const v1 = new OpenAPIHono<{ Variables: AuthVariables }>()
  .route(accountingModule.routePath, createGuardedRouter(accountingModule))
  .route(
    accountProvidersModule.routePath,
    createGuardedRouter(accountProvidersModule),
  )
  .route(accountsModule.routePath, createGuardedRouter(accountsModule))
  .route(balancesModule.routePath, createGuardedRouter(balancesModule))
  .route(
    counterpartiesModule.routePath,
    createGuardedRouter(counterpartiesModule),
  )
  .route(
    counterpartyGroupsModule.routePath,
    createGuardedRouter(counterpartyGroupsModule),
  )
  .route(customersModule.routePath, createGuardedRouter(customersModule))
  .route(currenciesModule.routePath, createGuardedRouter(currenciesModule))
  .route(paymentsModule.routePath, createGuardedRouter(paymentsModule))
  .route(connectorsModule.routePath, createGuardedRouter(connectorsModule))
  .route(
    orchestrationModule.routePath,
    createGuardedRouter(orchestrationModule),
  )
  .route(fxRatesModule.routePath, createGuardedRouter(fxRatesModule))
  .route(
    reconciliationModule.routePath,
    createGuardedRouter(reconciliationModule),
  )
  .route(
    systemModulesModule.routePath,
    createGuardedRouter(systemModulesModule),
  );

const _routes = app.route("/v1", v1);

const openApiInfo = {
  info: {
    title: "Bedrock API",
    version: "1.0.0",
    description: "Double-entry ledger API powered by TigerBeetle",
  },
};

// OpenAPI documentation
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
