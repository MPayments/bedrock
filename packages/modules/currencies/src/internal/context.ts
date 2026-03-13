import { noopLogger, type Logger } from "@bedrock/observability/logger";
import type { Database } from "@bedrock/persistence";

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
