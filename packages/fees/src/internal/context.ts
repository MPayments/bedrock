import { type Database } from "@bedrock/db";
import { type Logger } from "@bedrock/kernel";

export type FeesServiceDeps = {
    db: Database;
    logger?: Logger;
};

export type FeesServiceContext = {
    db: Database;
    log?: Logger;
};

export function createFeesServiceContext(deps: FeesServiceDeps): FeesServiceContext {
    return {
        db: deps.db,
        log: deps.logger?.child({ svc: "fees" }),
    };
}
