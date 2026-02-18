import { OpenAPIHono, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { AppError } from "@bedrock/kernel";
import auth from "@bedrock/auth";
import { createAppContext, type Env } from "./context";
import { organizationsRoutes, customersRoutes } from "./routes/index";
import { authMiddleware, requireAuth, type AuthVariables } from "./middleware/auth";
import dotenv from "dotenv";

// FIXME: in production, use proper env loading
dotenv.config({ path: "../../.env" });

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
const configuredAuthOrigins = env.BETTER_AUTH_TRUSTED_ORIGINS.split(",");
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

  ctx.logger.error("Unexpected error", { error: String(err) });
  return c.json({ error: "Internal server error" }, 500);
});

app.use(
  "/auth/*",
  cors({
    origin: (origin) => (authAllowedOriginSet.has(origin) ? origin : undefined),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    exposeHeaders: ["set-cookie"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

app.use("*", authMiddleware());

// Health check
app.get("/", (c) => {
  return c.json({ status: "ok", service: "ledger-api" });
});

// Mount routes under /v1 — all require an authenticated session
const v1 = new OpenAPIHono<{ Variables: AuthVariables }>();
v1.use("*", requireAuth());
v1
  .route("/organizations", organizationsRoutes(ctx))
  .route("/customers", customersRoutes(ctx));

const routes = app.route("/v1", v1);

// OpenAPI documentation
app.doc31("/openapi.json", (c) => ({
  openapi: "3.1.0",
  info: {
    title: "Ledger API",
    version: "1.0.0",
    description: "Double-entry ledger API powered by TigerBeetle",
  },
  servers: [
    {
      url: new URL(c.req.url).origin,
      description: "Current environment",
    },
  ],
}));

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

export { app };
export type AppType = typeof routes;
