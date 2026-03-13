import { OpenAPIHono } from "@hono/zod-openapi";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { registerAccountingCorrespondenceRoutes } from "./accounting/correspondence";
import type { AccountingRoutesApp } from "./accounting/report-route-kit";
import { registerAccountingReportRoutes } from "./accounting/reports";
import { registerAccountingTemplateRoutes } from "./accounting/templates";

export function accountingRoutes(ctx: AppContext): AccountingRoutesApp {
  const app: AccountingRoutesApp =
    new OpenAPIHono<{ Variables: AuthVariables }>();
  registerAccountingTemplateRoutes(app, ctx);
  registerAccountingCorrespondenceRoutes(app, ctx);
  registerAccountingReportRoutes(app, ctx);
  return app;
}
