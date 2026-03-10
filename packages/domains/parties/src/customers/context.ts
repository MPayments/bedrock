import { type Logger, noopLogger } from "@bedrock/common";
import type { Database } from "@bedrock/common/sql/ports";

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
