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
} from "../routes";
import type { ApiApplicationModuleDefinition } from "./types";

export type ApiApplicationModule<Path extends string = string> =
  ApiApplicationModuleDefinition<Path>;

export const accountingModule = {
  routePath: "/accounting",
  registerRoutes(ctx: AppContext) {
    return accountingRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/accounting">;

export const balancesModule = {
  routePath: "/balances",
  registerRoutes(ctx: AppContext) {
    return balancesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/balances">;

export const counterpartiesModule = {
  routePath: "/counterparties",
  registerRoutes(ctx: AppContext) {
    return counterpartiesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/counterparties">;

export const counterpartyGroupsModule = {
  routePath: "/counterparty-groups",
  registerRoutes(ctx: AppContext) {
    return counterpartyGroupsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/counterparty-groups">;

export const customersModule = {
  routePath: "/customers",
  registerRoutes(ctx: AppContext) {
    return customersRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/customers">;

export const currenciesModule = {
  routePath: "/currencies",
  registerRoutes(ctx: AppContext) {
    return currenciesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/currencies">;

export const documentsModule = {
  routePath: "/documents",
  registerRoutes(ctx: AppContext) {
    return documentsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/documents">;

export const fxRatesModule = {
  routePath: "/fx/rates",
  registerRoutes(ctx: AppContext) {
    return fxRatesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/fx/rates">;

export const paymentsModule = {
  routePath: "/payments",
  registerRoutes(ctx: AppContext) {
    return paymentsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/payments">;

export const organizationsModule = {
  routePath: "/organizations",
  registerRoutes(ctx: AppContext) {
    return organizationsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/organizations">;

export const requisiteProvidersModule = {
  routePath: "/requisite-providers",
  registerRoutes(ctx: AppContext) {
    return requisiteProvidersRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/requisite-providers">;

export const requisitesModule = {
  routePath: "/requisites",
  registerRoutes(ctx: AppContext) {
    return requisitesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/requisites">;

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
] as const;
