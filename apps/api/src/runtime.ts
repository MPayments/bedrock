import type { OpenAPIHono } from "@hono/zod-openapi";

import { db } from "@multihansa/db/client";
import {
  createMultihansaServices,
  type MultihansaDomainServices,
} from "@multihansa/app";
import { createConsoleLogger, type Logger } from "@multihansa/common";

import {
  accountingRoutes,
  balancesRoutes,
  counterpartiesRoutes,
  counterpartyGroupsRoutes,
  customersRoutes,
  currenciesRoutes,
  documentsRoutes,
  fxRatesRoutes,
  organizationsRoutes,
  paymentsRoutes,
  requisiteProvidersRoutes,
  requisitesRoutes,
} from "./routes";
import type { AppContext } from "./context";
import type { AuthVariables } from "./middleware/auth";

type ApiAppRouteRegistrar = (
  ctx: AppContext,
) => OpenAPIHono<{ Variables: AuthVariables }>;

export interface ApiRouteMount {
  id: string;
  routePath: string;
  registerRoutes: ApiAppRouteRegistrar;
}

export const API_ROUTE_MOUNTS = [
  {
    id: "accounting",
    routePath: "/accounting",
    registerRoutes: accountingRoutes,
  },
  {
    id: "balances",
    routePath: "/balances",
    registerRoutes: balancesRoutes,
  },
  {
    id: "counterparties",
    routePath: "/parties/counterparties",
    registerRoutes: counterpartiesRoutes,
  },
  {
    id: "counterparty-groups",
    routePath: "/counterparty-groups",
    registerRoutes: counterpartyGroupsRoutes,
  },
  {
    id: "customers",
    routePath: "/parties/customers",
    registerRoutes: customersRoutes,
  },
  {
    id: "currencies",
    routePath: "/currencies",
    registerRoutes: currenciesRoutes,
  },
  {
    id: "documents",
    routePath: "/documents",
    registerRoutes: documentsRoutes,
  },
  {
    id: "fx-rates",
    routePath: "/treasury/fx/rates",
    registerRoutes: fxRatesRoutes,
  },
  {
    id: "organizations",
    routePath: "/parties/organizations",
    registerRoutes: organizationsRoutes,
  },
  {
    id: "payments",
    routePath: "/treasury/payments",
    registerRoutes: paymentsRoutes,
  },
  {
    id: "requisite-providers",
    routePath: "/parties/requisite-providers",
    registerRoutes: requisiteProvidersRoutes,
  },
  {
    id: "requisites",
    routePath: "/parties/requisites",
    registerRoutes: requisitesRoutes,
  },
] as const satisfies readonly ApiRouteMount[];

export interface ApiRuntime {
  logger: Logger;
  services: MultihansaDomainServices;
  routeMounts: readonly ApiRouteMount[];
}

export function listApiRouteMounts(): ApiRouteMount[] {
  return [...API_ROUTE_MOUNTS];
}

export function createApiRuntime(): ApiRuntime {
  const logger = createConsoleLogger({ app: "multihansa-api" });
  const services = createMultihansaServices({ db, logger });

  return {
    logger,
    services,
    routeMounts: listApiRouteMounts(),
  };
}
