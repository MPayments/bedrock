import { noopLogger, type Logger } from "@bedrock/observability/logger";
import type { Database } from "@bedrock/adapter-db-drizzle/db/types";

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
