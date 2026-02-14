import { type Database } from "@bedrock/db";
import { type Logger } from "@bedrock/kernel";
import { type FeesService } from "@bedrock/fees";

export type FxServiceDeps = {
    db: Database;
    feesService: FeesService;
    logger?: Logger;
};

export type FxServiceContext = {
    db: Database;
    feesService: FeesService;
    log?: Logger;
};

export function createFxServiceContext(deps: FxServiceDeps): FxServiceContext {
    return {
        db: deps.db,
        feesService: deps.feesService,
        log: deps.logger?.child({ svc: "fx" }),
    };
}
