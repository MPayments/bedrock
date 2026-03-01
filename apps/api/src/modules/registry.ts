import type { BedrockModuleId } from "@bedrock/module-runtime";

import type { AppContext } from "../context";
import {
  accountingRoutes,
  accountProvidersRoutes,
  accountsRoutes,
  balancesRoutes,
  connectorsRoutes,
  counterpartiesRoutes,
  counterpartyGroupsRoutes,
  customersRoutes,
  currenciesRoutes,
  fxRatesRoutes,
  orchestrationRoutes,
  paymentsRoutes,
  reconciliationRoutes,
  systemModulesRoutes,
} from "../routes";
import type { ApplicationModule } from "./types";

export interface ApiApplicationModule<Path extends string = string>
  extends ApplicationModule<Path> {
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

export const accountProvidersModule = {
  id: "account-providers",
  routePath: "/account-providers",
  registerRoutes(ctx: AppContext) {
    return accountProvidersRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/account-providers">;

export const accountsModule = {
  id: "accounts",
  routePath: "/accounts",
  registerRoutes(ctx: AppContext) {
    return accountsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/accounts">;

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

export const connectorsModule = {
  id: "connectors",
  routePath: "/connectors",
  registerRoutes(ctx: AppContext) {
    return connectorsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/connectors">;

export const orchestrationModule = {
  id: "orchestration",
  routePath: "/orchestration",
  registerRoutes(ctx: AppContext) {
    return orchestrationRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/orchestration">;

export const reconciliationModule = {
  id: "reconciliation",
  routePath: "/reconciliation",
  registerRoutes(ctx: AppContext) {
    return reconciliationRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/reconciliation">;

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
  accountProvidersModule,
  accountsModule,
  balancesModule,
  counterpartiesModule,
  counterpartyGroupsModule,
  customersModule,
  currenciesModule,
  paymentsModule,
  connectorsModule,
  orchestrationModule,
  fxRatesModule,
  reconciliationModule,
  systemModulesModule,
] as const;
