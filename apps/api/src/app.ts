import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { AppError } from "@repo/kernel";
import { createAppContext, type Env } from "./context.js";
import { organizationsRoutes, customersRoutes } from "./routes/index.js";

// Load environment (in production, use proper env loading)
const env: Env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/postgres",
  TB_ADDRESS: process.env.TB_ADDRESS ?? "127.0.0.1:3000",
  TB_CLUSTER_ID: process.env.TB_CLUSTER_ID,
};

// Create application context (composition root)
const ctx = createAppContext(env);

// Create OpenAPIHono app with default error handler
const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: "Validation error",
          details: result.error.flatten(),
        },
        400
      );
    }
  },
});

// Global error handler for non-validation errors
app.onError((err, c) => {
  // Application errors
  if (AppError.is(err)) {
    ctx.logger.warn("Application error", { code: err.code, message: err.message });
    return c.json({ error: err.message, code: err.code }, 500);
  }

  // Unexpected errors
  ctx.logger.error("Unexpected error", { error: String(err) });
  return c.json({ error: "Internal server error" }, 500);
});

// Health check
app.get("/", (c) => {
  return c.json({ status: "ok", service: "ledger-api" });
});

// Mount routes
const routes = app
  .route("/organizations", organizationsRoutes(ctx))
  .route("/customers", customersRoutes(ctx));

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

// Swagger UI
app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// Export app for Bun/Cloudflare Workers
export { app };
// Export type for RPC client
export type AppType = typeof routes;
