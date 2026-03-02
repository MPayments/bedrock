import type { BedrockComponentId } from "@bedrock/modules/component-runtime";

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
  systemComponentsRoutes,
} from "../routes";
import type { ApplicationModule } from "./types";

export interface ApiApplicationComponent<Path extends string = string>
  extends ApplicationModule<Path> {
  id: BedrockComponentId;
  guarded?: boolean;
}

export const accountingComponent = {
  id: "accounting",
  routePath: "/accounting",
  registerRoutes(ctx: AppContext) {
    return accountingRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/accounting">;

export const accountProvidersComponent = {
  id: "account-providers",
  routePath: "/account-providers",
  registerRoutes(ctx: AppContext) {
    return accountProvidersRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/account-providers">;

export const accountsComponent = {
  id: "accounts",
  routePath: "/accounts",
  registerRoutes(ctx: AppContext) {
    return accountsRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/accounts">;

export const balancesComponent = {
  id: "balances",
  routePath: "/balances",
  registerRoutes(ctx: AppContext) {
    return balancesRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/balances">;

export const counterpartiesComponent = {
  id: "counterparties",
  routePath: "/counterparties",
  registerRoutes(ctx: AppContext) {
    return counterpartiesRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/counterparties">;

export const counterpartyGroupsComponent = {
  id: "counterparty-groups",
  routePath: "/counterparty-groups",
  registerRoutes(ctx: AppContext) {
    return counterpartyGroupsRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/counterparty-groups">;

export const customersComponent = {
  id: "customers",
  routePath: "/customers",
  registerRoutes(ctx: AppContext) {
    return customersRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/customers">;

export const currenciesComponent = {
  id: "currencies",
  routePath: "/currencies",
  registerRoutes(ctx: AppContext) {
    return currenciesRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/currencies">;

export const docsComponent = {
  id: "documents",
  routePath: "/docs",
  registerRoutes(ctx: AppContext) {
    return docsRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/docs">;

export const fxRatesComponent = {
  id: "fx-rates",
  routePath: "/fx/rates",
  registerRoutes(ctx: AppContext) {
    return fxRatesRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/fx/rates">;

export const paymentsComponent = {
  id: "payments",
  routePath: "/payments",
  registerRoutes(ctx: AppContext) {
    return paymentsRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/payments">;

export const connectorsComponent = {
  id: "connectors",
  routePath: "/connectors",
  registerRoutes(ctx: AppContext) {
    return connectorsRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/connectors">;

export const orchestrationComponent = {
  id: "orchestration",
  routePath: "/orchestration",
  registerRoutes(ctx: AppContext) {
    return orchestrationRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/orchestration">;

export const reconciliationComponent = {
  id: "reconciliation",
  routePath: "/reconciliation",
  registerRoutes(ctx: AppContext) {
    return reconciliationRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/reconciliation">;

export const systemComponentsComponent = {
  id: "system-components",
  routePath: "/system/components",
  guarded: false,
  registerRoutes(ctx: AppContext) {
    return systemComponentsRoutes(ctx);
  },
} as const satisfies ApiApplicationComponent<"/system/components">;

export const API_APPLICATION_COMPONENTS = [
  accountingComponent,
  accountProvidersComponent,
  accountsComponent,
  balancesComponent,
  counterpartiesComponent,
  counterpartyGroupsComponent,
  customersComponent,
  currenciesComponent,
  docsComponent,
  paymentsComponent,
  connectorsComponent,
  orchestrationComponent,
  fxRatesComponent,
  reconciliationComponent,
  systemComponentsComponent,
] as const;
