import { type CurrenciesService } from "@bedrock/currencies";
import { type Database } from "@bedrock/db";
import { type Logger } from "@bedrock/kernel";

export interface FeesServiceDeps {
    db: Database;
    logger?: Logger;
    currenciesService: CurrenciesService;
}

export interface FeesServiceContext {
    db: Database;
    log?: Logger;
    currenciesService: CurrenciesService;
}

export function createFeesServiceContext(deps: FeesServiceDeps): FeesServiceContext {
    return {
        db: deps.db,
        log: deps.logger?.child({ service: "fees" }),
        currenciesService: deps.currenciesService
    };
}
