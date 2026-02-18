import { type Database } from "@bedrock/db";
import { type Logger } from "@bedrock/kernel";
import { type FeesService } from "@bedrock/fees";
import { type CurrenciesService } from "@bedrock/currencies";

export type FxServiceDeps = {
    db: Database;
    feesService: FeesService;
    currenciesService: CurrenciesService;
    logger?: Logger;
};

export type FxServiceContext = {
    db: Database;
    feesService: FeesService;
    currenciesService: CurrenciesService;
    log?: Logger;
};

export function createFxServiceContext(deps: FxServiceDeps): FxServiceContext {
    return {
        db: deps.db,
        feesService: deps.feesService,
        currenciesService: deps.currenciesService,
        log: deps.logger?.child({ svc: "fx" }),
    };
}
