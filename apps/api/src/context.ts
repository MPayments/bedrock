import { createConsoleLogger } from "@bedrock/kernel";
import { db } from "@bedrock/db/client";
import { createOrganizationsService, type OrganizationsService } from "@bedrock/organizations";

export type Env = {
    DATABASE_URL: string;
    TB_ADDRESS: string;
    TB_CLUSTER_ID: string;
};

export function createAppContext(env: Env) {
    const logger = createConsoleLogger({ service: "bedrock-api" });
    const organizations = createOrganizationsService({ db, logger });

    return {
        env,
        logger,
        organizations,
    };
}

export type AppContext = ReturnType<typeof createAppContext>;
