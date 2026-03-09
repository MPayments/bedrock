import type { OpenAPIHono } from "@hono/zod-openapi";

import { db } from "@multihansa/db/client";
import {
  createMultihansaDomainBundle,
  type MultihansaDomainServices,
} from "@multihansa/app";
import { createConsoleLogger, type Logger } from "@bedrock/kernel";
import {
  createBedrockApp,
  defineModule,
  type BedrockAppRuntime,
  type BedrockModuleDefinition,
} from "@bedrock/modules";

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
  systemModulesRoutes,
} from "./routes";
import type { AppContext } from "./context";
import type { AuthVariables } from "./middleware/auth";

type ApiAppRouteRegistrar = (
  ctx: AppContext,
) => OpenAPIHono<{ Variables: AuthVariables }>;

const apiRouteRegistrars = new Map<string, ApiAppRouteRegistrar>([
  ["accounting", accountingRoutes],
  ["balances", balancesRoutes],
  ["counterparties", counterpartiesRoutes],
  ["counterparty-groups", counterpartyGroupsRoutes],
  ["customers", customersRoutes],
  ["currencies", currenciesRoutes],
  ["documents", documentsRoutes],
  ["fx-rates", fxRatesRoutes],
  ["organizations", organizationsRoutes],
  ["payments", paymentsRoutes],
  ["requisite-providers", requisiteProvidersRoutes],
  ["requisites", requisitesRoutes],
  ["system-modules", systemModulesRoutes],
]);

export interface ApiRuntime extends BedrockAppRuntime {
  logger: Logger;
  services: MultihansaDomainServices;
}

export type ApiRuntimeModule = BedrockModuleDefinition & {
  api: NonNullable<BedrockModuleDefinition["api"]> & {
    registerRoutes: NonNullable<
      NonNullable<BedrockModuleDefinition["api"]>["registerRoutes"]
    >;
  };
  registerRoutes: ApiAppRouteRegistrar;
};

export function createApiModules(
  modules: readonly BedrockModuleDefinition[],
): readonly BedrockModuleDefinition[] {
  return modules.map((module) => {
    if (!module.api) {
      return module;
    }

    const registerRoutes = apiRouteRegistrars.get(module.id);
    if (!registerRoutes) {
      throw new Error(`Missing API route registrar for module ${module.id}`);
    }

    return defineModule({
      ...module,
      api: {
        ...module.api,
        registerRoutes: (runtime) =>
          registerRoutes(runtime as unknown as AppContext),
      },
      registerRoutes,
    });
  });
}

export function listApiModules(
  modules: readonly BedrockModuleDefinition[],
): ApiRuntimeModule[] {
  return modules.filter((module): module is ApiRuntimeModule =>
    Boolean(module.api?.registerRoutes && "registerRoutes" in module),
  );
}

export function createApiRuntime(): ApiRuntime {
  const logger = createConsoleLogger({ app: "multihansa-api" });
  const bundle = createMultihansaDomainBundle({ db, logger });
  const app = createBedrockApp({
    db,
    logger,
    modules: createApiModules(bundle.modules),
    createServices: () => bundle.services,
  });

  return {
    ...app,
    logger,
    services: bundle.services,
  };
}
