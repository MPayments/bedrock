import { noopLogger, type Logger } from "@bedrock/kernel/logger";
import type { Database } from "@bedrock/kernel/db/types";

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
