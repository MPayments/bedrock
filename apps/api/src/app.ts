import { OpenAPIHono, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { sql } from "drizzle-orm";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";

import auth from "./auth";
import { createAppContext, parseEnv, type AppContext } from "./context";
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
  operationsRoutes,
  organizationsRoutes,
  profileRoutes,
  requisiteProvidersRoutes,
  requisitesRoutes,
  treasuryQuotesRoutes,
  treasuryRatesRoutes,
  usersRoutes,
} from "./routes";

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
    const { db } = await import("./db/client");
    await db.execute(sql`select 1`);
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

function createV1Routes(ctx: AppContext) {
  return new OpenAPIHono<{ Variables: AuthVariables }>()
    .route("/accounting", accountingRoutes(ctx))
    .route("/balances", balancesRoutes(ctx))
    .route("/counterparties", counterpartiesRoutes(ctx))
    .route("/counterparty-groups", counterpartyGroupsRoutes(ctx))
    .route("/customers", customersRoutes(ctx))
    .route("/currencies", currenciesRoutes(ctx))
    .route("/documents", documentsRoutes(ctx))
    .route("/organizations", organizationsRoutes(ctx))
    .route("/requisites/providers", requisiteProvidersRoutes(ctx))
    .route("/requisites", requisitesRoutes(ctx))
    .route("/treasury/quotes", treasuryQuotesRoutes(ctx))
    .route("/treasury/rates", treasuryRatesRoutes(ctx))
    .route("/users", usersRoutes(ctx))
    .route("/me", profileRoutes(ctx))
    .route("/operations", operationsRoutes(ctx));
}

const v1 = createV1Routes(ctx);
const _routes = new OpenAPIHono<{ Variables: AuthVariables }>().route("/v1", v1);

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
export type AppType = typeof _routes;
