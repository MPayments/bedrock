import { type Database } from "@bedrock/db";
import { type Logger } from "@bedrock/kernel";
import { type CurrenciesService } from "@bedrock/currencies";

export type FeesServiceDeps = {
    db: Database;
    logger?: Logger;
    currenciesService: CurrenciesService;
};

export type FeesServiceContext = {
    db: Database;
    log?: Logger;
    currenciesService: CurrenciesService;
};

export function createFeesServiceContext(deps: FeesServiceDeps): FeesServiceContext {
    return {
        db: deps.db,
        log: deps.logger?.child({ svc: "fees" }),
        currenciesService: deps.currenciesService
    };
}
