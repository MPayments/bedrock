import { OpenAPIHono, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";

import auth from "@bedrock/auth";
import { AppError } from "@bedrock/kernel";

import { createAppContext, type Env } from "./context";
import { authMiddleware, requireAuth, type AuthVariables } from "./middleware/auth";
import { organizationsRoutes, customersRoutes, currenciesRoutes, fxRatesRoutes } from "./routes/index";

const env: Env = {
  DATABASE_URL:
    process.env.DATABASE_URL!,
  TB_ADDRESS: process.env.TB_ADDRESS!,
  TB_CLUSTER_ID: Number(process.env.TB_CLUSTER_ID!),
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL!,
  BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS!,
};

const ctx = createAppContext(env);
const configuredAuthOrigins = env.BETTER_AUTH_TRUSTED_ORIGINS
  .split(",")
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
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["set-cookie"],
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

// Health check
app.get("/", (c) => {
  return c.json({ status: "ok", service: "ledger-api" });
});

// Mount routes under /v1 — all require an authenticated session
const v1 = new OpenAPIHono<{ Variables: AuthVariables }>()
  .use("*", requireAuth())
  .route("/organizations", organizationsRoutes(ctx))
  .route("/customers", customersRoutes(ctx))
  .route("/currencies", currenciesRoutes(ctx))
  .route("/fx/rates", fxRatesRoutes(ctx));
const routes = app.route("/v1", v1);

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
export type AppType = typeof routes;
