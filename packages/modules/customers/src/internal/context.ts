import type { Database } from "@bedrock/foundation/db-types";
import { type Logger, noopLogger } from "@bedrock/foundation/kernel";

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
