import type { Database } from "@bedrock/foundation/db-types";
import { type Logger } from "@bedrock/foundation/kernel";

import { type FeesCurrencyLookup } from "./currency-lookup";

export interface FeesServiceDeps {
    db: Database;
    logger?: Logger;
    currenciesService: FeesCurrencyLookup;
}

export interface FeesServiceContext {
    db: Database;
    log?: Logger;
    currenciesService: FeesCurrencyLookup;
}

export function createFeesServiceContext(deps: FeesServiceDeps): FeesServiceContext {
    return {
        db: deps.db,
        log: deps.logger?.child({ service: "fees" }),
        currenciesService: deps.currenciesService
    };
}
