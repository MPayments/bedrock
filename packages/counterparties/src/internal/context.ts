import { type Database } from "@bedrock/db";
import { type Logger, noopLogger } from "@bedrock/kernel";

export interface CounterpartiesServiceDeps {
    db: Database;
    logger?: Logger;
}

export interface CounterpartiesServiceContext {
    db: Database;
    log: Logger;
}

export function createCounterpartiesServiceContext(
    deps: CounterpartiesServiceDeps,
): CounterpartiesServiceContext {
    return {
        db: deps.db,
        log: deps.logger?.child({ svc: "counterparties" }) ?? noopLogger,
    };
}
