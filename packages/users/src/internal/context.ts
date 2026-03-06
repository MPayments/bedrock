import { type Database } from "@bedrock/db";
import { type Logger, noopLogger } from "@bedrock/kernel";

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
