import type { AppContext } from "../context";
import { fxRatesRoutes, transfersRoutes, treasuryRoutes } from "../routes";
import type { ApplicationModule } from "./types";

export const fxRatesModule = {
  id: "fx-rates",
  routePath: "/fx/rates",
  registerRoutes(ctx: AppContext) {
    return fxRatesRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/fx/rates">;

export const transfersModule = {
  id: "transfers",
  routePath: "/transfers",
  registerRoutes(ctx: AppContext) {
    return transfersRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/transfers">;

export const treasuryModule = {
  id: "treasury",
  routePath: "/treasury",
  registerRoutes(ctx: AppContext) {
    return treasuryRoutes(ctx);
  },
} as const satisfies ApplicationModule<"/treasury">;

export const API_APPLICATION_MODULES = [
  fxRatesModule,
  transfersModule,
  treasuryModule,
] as const;
