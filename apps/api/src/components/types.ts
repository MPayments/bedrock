import type { OpenAPIHono } from "@hono/zod-openapi";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";

export type ApiComponentRouter = OpenAPIHono<{ Variables: AuthVariables }>;

export interface ApiApplicationComponentDefinition<Path extends string = string> {
  id: string;
  routePath: Path;
  registerRoutes: (ctx: AppContext) => ApiComponentRouter;
}
