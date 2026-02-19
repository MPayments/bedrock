import { type CurrenciesService } from "@bedrock/currencies";
import { type Database } from "@bedrock/db";
import { type FeesService } from "@bedrock/fees";
import { type Logger } from "@bedrock/kernel";

export interface FxServiceDeps {
    db: Database;
    feesService: FeesService;
    currenciesService: CurrenciesService;
    logger?: Logger;
}

export interface FxServiceContext {
    db: Database;
    feesService: FeesService;
    currenciesService: CurrenciesService;
    log?: Logger;
}

export function createFxServiceContext(deps: FxServiceDeps): FxServiceContext {
    return {
        db: deps.db,
        feesService: deps.feesService,
        currenciesService: deps.currenciesService,
        log: deps.logger?.child({ svc: "fx" }),
    };
}
