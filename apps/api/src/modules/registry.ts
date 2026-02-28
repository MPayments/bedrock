import type { AppContext } from "../context";
import { docsRoutes, fxRatesRoutes } from "../routes";
import type { ApplicationModule } from "./types";

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
