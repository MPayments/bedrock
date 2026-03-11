import { type Logger, noopLogger } from "@multihansa/common";
import type { Database } from "@multihansa/common/sql/ports";

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
