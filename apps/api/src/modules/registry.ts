import type { BedrockModuleId } from "@bedrock/application/module-runtime";

import type { AppContext } from "../context";
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
} from "../routes";
import type { ApiApplicationModuleDefinition } from "./types";

export interface ApiApplicationModule<Path extends string = string>
  extends ApiApplicationModuleDefinition<Path> {
  id: BedrockModuleId;
  guarded?: boolean;
}

export const accountingModule = {
  id: "accounting",
  routePath: "/accounting",
  registerRoutes(ctx: AppContext) {
    return accountingRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/accounting">;

export const balancesModule = {
  id: "balances",
  routePath: "/balances",
  registerRoutes(ctx: AppContext) {
    return balancesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/balances">;

export const counterpartiesModule = {
  id: "counterparties",
  routePath: "/counterparties",
  registerRoutes(ctx: AppContext) {
    return counterpartiesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/counterparties">;

export const counterpartyGroupsModule = {
  id: "counterparty-groups",
  routePath: "/counterparty-groups",
  registerRoutes(ctx: AppContext) {
    return counterpartyGroupsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/counterparty-groups">;

export const customersModule = {
  id: "customers",
  routePath: "/customers",
  registerRoutes(ctx: AppContext) {
    return customersRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/customers">;

export const currenciesModule = {
  id: "currencies",
  routePath: "/currencies",
  registerRoutes(ctx: AppContext) {
    return currenciesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/currencies">;

export const documentsModule = {
  id: "documents",
  routePath: "/documents",
  registerRoutes(ctx: AppContext) {
    return documentsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/documents">;

export const fxRatesModule = {
  id: "fx-rates",
  routePath: "/fx/rates",
  registerRoutes(ctx: AppContext) {
    return fxRatesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/fx/rates">;

export const paymentsModule = {
  id: "payments",
  routePath: "/payments",
  registerRoutes(ctx: AppContext) {
    return paymentsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/payments">;

export const organizationsModule = {
  id: "organizations",
  routePath: "/organizations",
  registerRoutes(ctx: AppContext) {
    return organizationsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/organizations">;

export const requisiteProvidersModule = {
  id: "requisite-providers",
  routePath: "/requisite-providers",
  registerRoutes(ctx: AppContext) {
    return requisiteProvidersRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/requisite-providers">;

export const requisitesModule = {
  id: "requisites",
  routePath: "/requisites",
  registerRoutes(ctx: AppContext) {
    return requisitesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/requisites">;

export const systemModulesModule = {
  id: "system-modules",
  routePath: "/system/modules",
  guarded: false,
  registerRoutes(ctx: AppContext) {
    return systemModulesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/system/modules">;

export const API_APPLICATION_MODULES = [
  accountingModule,
  balancesModule,
  counterpartiesModule,
  counterpartyGroupsModule,
  customersModule,
  currenciesModule,
  documentsModule,
  organizationsModule,
  paymentsModule,
  requisiteProvidersModule,
  requisitesModule,
  fxRatesModule,
  systemModulesModule,
] as const;
