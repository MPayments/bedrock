import type { Database } from "@bedrock/db/types";
import { type Logger, noopLogger } from "@bedrock/foundation/kernel";

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
