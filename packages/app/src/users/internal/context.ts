import { type Logger, noopLogger } from "@bedrock/common";
import type { Database } from "@bedrock/common/db/types";

export interface UsersServiceDeps {
    db: Database;
    logger?: Logger;
}

export interface UsersServiceContext {
    db: Database;
    log: Logger;
}

export function createUsersServiceContext(
    deps: UsersServiceDeps,
): UsersServiceContext {
    return {
        db: deps.db,
        log: deps.logger?.child({ service: "users" }) ?? noopLogger,
    };
}
