import { OpenAPIHono } from "@hono/zod-openapi";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";

import { operationsActivityLogRoutes } from "./activity-log";
import { operationsAgentsRoutes } from "./agents";
import { operationsApplicationsRoutes } from "./applications";
import { operationsCalculationsRoutes } from "./calculations";
import { operationsClientsRoutes } from "./clients";
import { operationsCustomersRoutes } from "./customers";
import { operationsContractsRoutes } from "./contracts";
import { operationsCustomerPortalRoutes } from "./customer-portal";
import { operationsDealsRoutes } from "./deals";
import { operationsDocumentsRoutes } from "./documents";
import { operationsOrganizationsRoutes } from "./organizations";
import { operationsTodosRoutes } from "./todos";

export function operationsRoutes(ctx: AppContext) {
  return new OpenAPIHono<{ Variables: AuthVariables }>()
    .route("/clients", operationsClientsRoutes(ctx))
    .route("/customers", operationsCustomersRoutes(ctx))
    .route("/applications", operationsApplicationsRoutes(ctx))
    .route("/calculations", operationsCalculationsRoutes(ctx))
    .route("/deals", operationsDealsRoutes(ctx))
    .route("/contracts", operationsContractsRoutes(ctx))
    .route("/organizations", operationsOrganizationsRoutes(ctx))
    .route("/todos", operationsTodosRoutes(ctx))
    .route("/activity-log", operationsActivityLogRoutes(ctx))
    .route("/agents", operationsAgentsRoutes(ctx))
    .route("/customer", operationsCustomerPortalRoutes(ctx))
    .route("/documents", operationsDocumentsRoutes(ctx));
}
