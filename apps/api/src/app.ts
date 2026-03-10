import { OpenAPIHono, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";

import auth from "./auth";
import { createAppContext, parseEnv } from "./context";
import {
  authMiddleware,
  requireAuth,
  type AuthVariables,
} from "./middleware/auth";
import { requestContextMiddleware } from "./middleware/request-context";
import {
  accountingRoutes,
  balancesRoutes,
  counterpartiesRoutes,
  counterpartyGroupsRoutes,
  customersRoutes,
  currenciesRoutes,
  documentsRoutes,
  fxRatesRoutes,
  organizationsRoutes,
  paymentsRoutes,
  profileRoutes,
  requisiteProvidersRoutes,
  requisitesRoutes,
  usersRoutes,
} from "./routes";
import { listApiRouteMounts } from "./runtime";

const env = parseEnv();

const ctx = createAppContext(env);
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
  return c.json({ status: "ok", service: "multihansa-api" });
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
    const { db } = await import("@multihansa/db/client");
    const { schema } = await import("@bedrock/finance/assets/schema");
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

function buildV1Router(): OpenAPIHono<{ Variables: AuthVariables }> {
  const router = new OpenAPIHono<{ Variables: AuthVariables }>();

  for (const routeMount of ctx.app.routeMounts) {
    router.route(routeMount.routePath, routeMount.registerRoutes(ctx));
  }

  router.route("/users", usersRoutes(ctx));
  router.route("/me", profileRoutes(ctx));

  return router;
}

const TYPED_ROUTE_PATHS = [
  "/finance/accounting",
  "/finance/balances",
  "/parties/counterparties",
  "/counterparty-groups",
  "/parties/customers",
  "/currencies",
  "/documents",
  "/parties/organizations",
  "/treasury/payments",
  "/parties/requisite-providers",
  "/parties/requisites",
  "/treasury/fx/rates",
] as const;

function assertTypedRouteCoverage() {
  const typedRoutePaths = [...TYPED_ROUTE_PATHS].sort();
  const mountedRoutePaths = listApiRouteMounts()
    .map((routeMount) => routeMount.routePath)
    .sort();

  const hasMismatch =
    typedRoutePaths.length !== mountedRoutePaths.length ||
    typedRoutePaths.some((path, index) => path !== mountedRoutePaths[index]);
  if (hasMismatch) {
    throw new Error(
      `Typed API route mounts are out of sync with explicit route registry. typed=${typedRoutePaths.join(",")} mounted=${mountedRoutePaths.join(",")}`,
    );
  }
}

assertTypedRouteCoverage();

const typedV1 = new OpenAPIHono<{ Variables: AuthVariables }>()
  .route("/finance/accounting", accountingRoutes(ctx))
  .route("/finance/balances", balancesRoutes(ctx))
  .route("/parties/counterparties", counterpartiesRoutes(ctx))
  .route("/counterparty-groups", counterpartyGroupsRoutes(ctx))
  .route("/parties/customers", customersRoutes(ctx))
  .route("/currencies", currenciesRoutes(ctx))
  .route("/documents", documentsRoutes(ctx))
  .route("/parties/organizations", organizationsRoutes(ctx))
  .route("/treasury/payments", paymentsRoutes(ctx))
  .route("/parties/requisite-providers", requisiteProvidersRoutes(ctx))
  .route("/parties/requisites", requisitesRoutes(ctx))
  .route("/treasury/fx/rates", fxRatesRoutes(ctx))
  .route("/users", usersRoutes(ctx))
  .route("/me", profileRoutes(ctx));

const typedRoutes = new OpenAPIHono<{ Variables: AuthVariables }>().route(
  "/v1",
  typedV1,
);

const v1 = buildV1Router();

app.route("/v1", v1);

const openApiInfo = {
  info: {
    title: "Multihansa API",
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
