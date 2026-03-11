import { type Logger, noopLogger } from "@multihansa/common";
import type { Database } from "@multihansa/common/sql/ports";
import { type CurrenciesService } from "@multihansa/assets";

import { type FeesService } from "@multihansa/treasury/fees";

import { createCbrRateSourceProvider } from "./sources/cbr";
import { createInvestingRateSourceProvider } from "./sources/investing";
import { type FxRateSource, type FxRateSourceProvider } from "./sources/types";
import { createXeRateSourceProvider } from "./sources/xe";

export interface FxServiceDeps {
    db: Database;
    feesService: FeesService;
    currenciesService: CurrenciesService;
    logger?: Logger;
    rateSourceProviders?: Partial<Record<FxRateSource, FxRateSourceProvider>>;
}

export interface FxServiceContext {
    db: Database;
    feesService: FeesService;
    currenciesService: CurrenciesService;
    log: Logger;
    rateSourceProviders: Record<FxRateSource, FxRateSourceProvider>;
}

export function createFxServiceContext(deps: FxServiceDeps): FxServiceContext {
    const defaultProviders: Record<FxRateSource, FxRateSourceProvider> = {
        cbr: createCbrRateSourceProvider(),
        investing: createInvestingRateSourceProvider(),
        xe: createXeRateSourceProvider(),
    };

    return {
        db: deps.db,
        feesService: deps.feesService,
        currenciesService: deps.currenciesService,
        log: deps.logger?.child({ service: "fx" }) ?? noopLogger,
        rateSourceProviders: {
            ...defaultProviders,
            ...deps.rateSourceProviders,
        },
    };
}
