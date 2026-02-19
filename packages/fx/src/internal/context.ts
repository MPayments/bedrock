import { type CurrenciesService } from "@bedrock/currencies";
import { type Database } from "@bedrock/db";
import { type FeesService } from "@bedrock/fees";
import { type Logger, noopLogger } from "@bedrock/kernel";

import { createCbrRateSourceProvider } from "../sources/cbr";
import { type FxRateSource, type FxRateSourceProvider } from "../sources/types";

export interface FxServiceDeps {
    db: Database;
    feesService: FeesService;
    currenciesService: CurrenciesService;
    logger?: Logger;
    fetchFn?: typeof fetch;
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
    const cbrProvider = deps.rateSourceProviders?.cbr ?? createCbrRateSourceProvider({
        fetchFn: deps.fetchFn,
    });

    return {
        db: deps.db,
        feesService: deps.feesService,
        currenciesService: deps.currenciesService,
        log: deps.logger?.child({ svc: "fx" }) ?? noopLogger,
        rateSourceProviders: {
            cbr: cbrProvider,
        },
    };
}
