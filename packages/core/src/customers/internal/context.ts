import type { Database } from "@bedrock/kernel/db/types";
import { type Logger, noopLogger } from "@bedrock/kernel";

export interface CustomersServiceDeps {
    db: Database;
    logger?: Logger;
}

export interface CustomersServiceContext {
    db: Database;
    log: Logger;
}

export function createCustomersServiceContext(
    deps: CustomersServiceDeps,
): CustomersServiceContext {
    return {
        db: deps.db,
        log: deps.logger?.child({ service: "customers" }) ?? noopLogger,
    };
}
