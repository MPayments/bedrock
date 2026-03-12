import type { AppContext } from "../context";
import {
  accountingRoutes,
  balancesRoutes,
  counterpartiesRoutes,
  counterpartyGroupsRoutes,
  customersRoutes,
  currenciesRoutes,
  documentsRoutes,
  fxQuotesRoutes,
  fxRatesRoutes,
  organizationsRoutes,
  requisiteProvidersRoutes,
  requisitesRoutes,
} from "../routes";
import type { ApiApplicationModuleDefinition } from "./types";

export type ApiApplicationModule<Path extends string = string> =
  ApiApplicationModuleDefinition<Path>;

const accountingModule = {
  routePath: "/accounting",
  registerRoutes(ctx: AppContext) {
    return accountingRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/accounting">;

const balancesModule = {
  routePath: "/balances",
  registerRoutes(ctx: AppContext) {
    return balancesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/balances">;

const counterpartiesModule = {
  routePath: "/counterparties",
  registerRoutes(ctx: AppContext) {
    return counterpartiesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/counterparties">;

const counterpartyGroupsModule = {
  routePath: "/counterparty-groups",
  registerRoutes(ctx: AppContext) {
    return counterpartyGroupsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/counterparty-groups">;

const customersModule = {
  routePath: "/customers",
  registerRoutes(ctx: AppContext) {
    return customersRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/customers">;

const currenciesModule = {
  routePath: "/currencies",
  registerRoutes(ctx: AppContext) {
    return currenciesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/currencies">;

const documentsModule = {
  routePath: "/documents",
  registerRoutes(ctx: AppContext) {
    return documentsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/documents">;

const fxRatesModule = {
  routePath: "/fx/rates",
  registerRoutes(ctx: AppContext) {
    return fxRatesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/fx/rates">;

const fxQuotesModule = {
  routePath: "/fx/quotes",
  registerRoutes(ctx: AppContext) {
    return fxQuotesRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/fx/quotes">;

const organizationsModule = {
  routePath: "/organizations",
  registerRoutes(ctx: AppContext) {
    return organizationsRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/organizations">;

const requisiteProvidersModule = {
  routePath: "/requisite-providers",
  registerRoutes(ctx: AppContext) {
    return requisiteProvidersRoutes(ctx);
  },
} as const satisfies ApiApplicationModule<"/requisite-providers">;

const requisitesModule = {
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
  requisiteProvidersModule,
  requisitesModule,
  fxQuotesModule,
  fxRatesModule,
] as const;
