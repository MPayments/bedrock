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
  docsRoutes,
  fxRatesRoutes,
  orchestrationRoutes,
  paymentsRoutes,
  reconciliationRoutes,
} from "../routes";
import type { ApplicationModule } from "./types";

export const accountingModule = {
  id: "accounting",
  routePath: "/accounting",
  registerRoutes(ctx: AppContext) {
    return accountingRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/accounting">;

export const accountProvidersModule = {
  id: "account-providers",
  routePath: "/account-providers",
  registerRoutes(ctx: AppContext) {
    return accountProvidersRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/account-providers">;

export const accountsModule = {
  id: "accounts",
  routePath: "/accounts",
  registerRoutes(ctx: AppContext) {
    return accountsRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/accounts">;

export const balancesModule = {
  id: "balances",
  routePath: "/balances",
  registerRoutes(ctx: AppContext) {
    return balancesRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/balances">;

export const counterpartiesModule = {
  id: "counterparties",
  routePath: "/counterparties",
  registerRoutes(ctx: AppContext) {
    return counterpartiesRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/counterparties">;

export const counterpartyGroupsModule = {
  id: "counterparty-groups",
  routePath: "/counterparty-groups",
  registerRoutes(ctx: AppContext) {
    return counterpartyGroupsRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/counterparty-groups">;

export const customersModule = {
  id: "customers",
  routePath: "/customers",
  registerRoutes(ctx: AppContext) {
    return customersRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/customers">;

export const currenciesModule = {
  id: "currencies",
  routePath: "/currencies",
  registerRoutes(ctx: AppContext) {
    return currenciesRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/currencies">;

export const fxRatesModule = {
  id: "fx-rates",
  routePath: "/fx/rates",
  registerRoutes(ctx: AppContext) {
    return fxRatesRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/fx/rates">;

export const docsModule = {
  id: "docs",
  routePath: "/docs",
  registerRoutes(ctx: AppContext) {
    return docsRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/docs">;

export const paymentsModule = {
  id: "payments",
  routePath: "/payments",
  registerRoutes(ctx: AppContext) {
    return paymentsRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/payments">;

export const connectorsModule = {
  id: "connectors",
  routePath: "/connectors",
  registerRoutes(ctx: AppContext) {
    return connectorsRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/connectors">;

export const orchestrationModule = {
  id: "orchestration",
  routePath: "/orchestration",
  registerRoutes(ctx: AppContext) {
    return orchestrationRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/orchestration">;

export const reconciliationModule = {
  id: "reconciliation",
  routePath: "/reconciliation",
  registerRoutes(ctx: AppContext) {
    return reconciliationRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/reconciliation">;
