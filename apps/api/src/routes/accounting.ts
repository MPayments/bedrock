import { OpenAPIHono } from "@hono/zod-openapi";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { registerAccountingCorrespondenceRoutes } from "./accounting/correspondence";
import { registerAccountingReportRoutes } from "./accounting/reports";
import { registerAccountingTemplateRoutes } from "./accounting/templates";

export function accountingRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  registerAccountingTemplateRoutes(app, ctx);
  registerAccountingCorrespondenceRoutes(app, ctx);
  registerAccountingReportRoutes(app, ctx);
  return app;
}
