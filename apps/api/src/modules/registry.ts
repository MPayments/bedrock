import type { BedrockModuleId } from "@bedrock/application/module-runtime";

import type { AppContext } from "../context";
import {
  accountingRoutes,
  balancesRoutes,
  counterpartiesRoutes,
  counterpartyRequisitesRoutes,
  counterpartyGroupsRoutes,
  customersRoutes,
  currenciesRoutes,
  documentsRoutes,
  fxRatesRoutes,
  organizationRequisitesRoutes,
  paymentsRoutes,
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

export const counterpartyRequisitesModule = {
  id: "counterparty-requisites",
  routePath: "/counterparty-requisites",
  registerRoutes(ctx: AppContext) {
    return counterpartyRequisitesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/counterparty-requisites">;

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

export const organizationRequisitesModule = {
  id: "organization-requisites",
  routePath: "/organization-requisites",
  registerRoutes(ctx: AppContext) {
    return organizationRequisitesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/organization-requisites">;

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
  counterpartyRequisitesModule,
  balancesModule,
  counterpartiesModule,
  counterpartyGroupsModule,
  customersModule,
  currenciesModule,
  documentsModule,
  organizationRequisitesModule,
  paymentsModule,
  fxRatesModule,
  systemModulesModule,
] as const;
