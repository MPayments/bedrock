import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";

import type { IntegrationEventHandler } from "@bedrock/workflow-integration-mpayments";

export interface IntegrationRoutesDeps {
  integrationEventHandler: IntegrationEventHandler;
  username: string;
  password: string;
}

export function integrationRoutes(deps: IntegrationRoutesDeps) {
  const app = new Hono();

  app.use(
    "*",
    basicAuth({
      username: deps.username,
      password: deps.password,
    }),
  );

  app.post("/events", async (c) => {
    const body = await c.req.json();
    await deps.integrationEventHandler.processEvent(body);
    return c.json({ ok: true });
  });

  return app;
}
