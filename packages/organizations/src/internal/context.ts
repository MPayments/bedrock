import { type Database } from "@bedrock/db";
import { type Logger } from "@bedrock/kernel";

export type OrganizationsServiceDeps = {
    db: Database;
    logger?: Logger;
};

export type OrganizationsServiceContext = {
    db: Database;
    log?: Logger;
};

export function createOrganizationsServiceContext(deps: OrganizationsServiceDeps): OrganizationsServiceContext {
    return {
        db: deps.db,
        log: deps.logger?.child({ svc: "organizations" }),
    };
}
