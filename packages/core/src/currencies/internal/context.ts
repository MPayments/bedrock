import type { Database } from "@bedrock/kernel/db/types";
import { type Logger, noopLogger } from "@bedrock/kernel";

export interface CurrenciesServiceDeps {
    db: Database;
    logger?: Logger;
}

interface CurrenciesServiceContext {
    db: Database;
    log: Logger;
}

export function createCurrenciesServiceContext(
    deps: CurrenciesServiceDeps,
): CurrenciesServiceContext {
    return {
        db: deps.db,
        log: deps.logger?.child({ service: "currencies" }) ?? noopLogger,
    };
}
