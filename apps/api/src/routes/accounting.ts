import { OpenAPIHono } from "@hono/zod-openapi";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { accountingCorrespondenceRoutes } from "./accounting/correspondence";
import { accountingReportRoutes } from "./accounting/reports";
import { accountingTemplateRoutes } from "./accounting/templates";

export function accountingRoutes(ctx: AppContext) {
  return new OpenAPIHono<{ Variables: AuthVariables }>()
    .route("/template", accountingTemplateRoutes(ctx))
    .route("/correspondence-rules", accountingCorrespondenceRoutes(ctx))
    .route("/reports", accountingReportRoutes(ctx));
}
