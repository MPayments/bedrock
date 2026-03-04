import { OpenAPIHono, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";

import {
  ModuleDependencyViolationError,
  ModuleDisabledError,
  ModuleStateVersionConflictError,
  ImmutableModuleError,
  MixedDeployError,
  UnknownModuleError,
} from "@bedrock/core/module-runtime";

import auth from "./auth";
import {
  API_APPLICATION_MODULES,
  type ApiApplicationModule,
} from "./modules/registry";
import { createAppContext, parseEnv } from "./context";
import {
  authMiddleware,
  requireAuth,
  type AuthVariables,
} from "./middleware/auth";
import { createModuleGuard } from "./middleware/module-guard";
import { requestContextMiddleware } from "./middleware/request-context";
import {
  accountingRoutes,
  counterpartyAccountProvidersRoutes,
  counterpartyAccountsRoutes,
  balancesRoutes,
  counterpartiesRoutes,
  counterpartyGroupsRoutes,
  customersRoutes,
  currenciesRoutes,
  documentsRoutes,
  fxRatesRoutes,
  paymentsRoutes,
  reconciliationRoutes,
  systemModulesRoutes,
} from "./routes";

const env = parseEnv();

const ctx = createAppContext(env);
void ctx.moduleRuntime.startBackgroundSync().catch((error: unknown) => {
  ctx.logger.warn("Failed to start module runtime background sync", {
    error: error instanceof Error ? error.message : String(error),
  });
});
void ctx.documentsService
  .validateAccountingSourceCoverage()
  .catch((error: unknown) => {
    ctx.logger.error(
      "Active accounting pack is incompatible with document sources",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
    process.exitCode = 1;
    setImmediate(() => process.exit(1));
  });
void ctx.assertInternalLedgerInvariants().catch((error: unknown) => {
  ctx.logger.error("Internal ledger invariants check failed", {
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

  ctx.logger.error("Unexpected error", {
    error: String(err),
    cause: err.cause ? String(err.cause) : undefined,
  });
  return c.json({ error: "Internal server error" }, 500);
});

app.use(
  "*",
  cors({
    origin: (origin: string) =>
      authAllowedOriginSet.has(origin) ? origin : undefined,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "X-Book-Id",
    ],
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

app.get("/health", async (c) => {
  const checks: Record<
    string,
    { status: string; latencyMs?: number; error?: string }
  > = {};
  let healthy = true;

  // PostgreSQL check
  const pgStart = Date.now();
  try {
    const { db } = await import("@bedrock/db/client");
    const { schema } = await import("@bedrock/core/currencies/schema");
    await db
      .select({ id: schema.currencies.id })
      .from(schema.currencies)
      .limit(1);
    checks.postgres = { status: "up", latencyMs: Date.now() - pgStart };
  } catch (error) {
    healthy = false;
    checks.postgres = {
      status: "down",
      latencyMs: Date.now() - pgStart,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const status = healthy ? 200 : 503;
  return c.json({ status: healthy ? "healthy" : "degraded", checks }, status);
});

function createGuardedRouter(module: ApiApplicationModule) {
  const guarded = new OpenAPIHono<{ Variables: AuthVariables }>();
  if (module.guarded !== false) {
    guarded.use("*", createModuleGuard(ctx, module.id));
  }
  guarded.route("/", module.registerRoutes(ctx));
  return guarded;
}

function buildV1Router(
  guarded: boolean,
): OpenAPIHono<{ Variables: AuthVariables }> {
  const router = new OpenAPIHono<{ Variables: AuthVariables }>();

  for (const module of API_APPLICATION_MODULES) {
    router.route(
      module.routePath,
      guarded ? createGuardedRouter(module) : module.registerRoutes(ctx),
    );
  }

  return router;
}

const TYPED_ROUTE_PATHS = [
  "/accounting",
  "/counterparty-account-providers",
  "/counterparty-accounts",
  "/balances",
  "/counterparties",
  "/counterparty-groups",
  "/customers",
  "/currencies",
  "/documents",
  "/payments",
  "/fx/rates",
  "/reconciliation",
  "/system/modules",
] as const;

function assertTypedRouteCoverage() {
  const typedRoutePaths = [...TYPED_ROUTE_PATHS].sort();
  const moduleRoutePaths = API_APPLICATION_MODULES.map(
    (module) => module.routePath,
  ).sort();

  const hasMismatch =
    typedRoutePaths.length !== moduleRoutePaths.length ||
    typedRoutePaths.some((path, index) => path !== moduleRoutePaths[index]);
  if (hasMismatch) {
    throw new Error(
      `Typed API route mounts are out of sync with module registry. typed=${typedRoutePaths.join(",")} modules=${moduleRoutePaths.join(",")}`,
    );
  }
}

assertTypedRouteCoverage();

const typedV1 = new OpenAPIHono<{ Variables: AuthVariables }>()
  .route("/accounting", accountingRoutes(ctx))
  .route(
    "/counterparty-account-providers",
    counterpartyAccountProvidersRoutes(ctx),
  )
  .route("/counterparty-accounts", counterpartyAccountsRoutes(ctx))
  .route("/balances", balancesRoutes(ctx))
  .route("/counterparties", counterpartiesRoutes(ctx))
  .route("/counterparty-groups", counterpartyGroupsRoutes(ctx))
  .route("/customers", customersRoutes(ctx))
  .route("/currencies", currenciesRoutes(ctx))
  .route("/documents", documentsRoutes(ctx))
  .route("/payments", paymentsRoutes(ctx))
  .route("/fx/rates", fxRatesRoutes(ctx))
  .route("/reconciliation", reconciliationRoutes(ctx))
  .route("/system/modules", systemModulesRoutes(ctx));

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
