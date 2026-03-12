import type { OpenAPIHono } from "@hono/zod-openapi";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";

export type ApiModuleRouter = OpenAPIHono<{ Variables: AuthVariables }>;

export interface ApiApplicationModuleDefinition<Path extends string = string> {
  id: string;
  routePath: Path;
  registerRoutes: (ctx: AppContext) => ApiModuleRouter;
}
