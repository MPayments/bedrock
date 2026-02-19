import { createCurrenciesService } from "@bedrock/currencies";
import { db } from "@bedrock/db/client";
import { createConsoleLogger } from "@bedrock/kernel";
import { createOrganizationsService } from "@bedrock/organizations";

export interface Env {
    DATABASE_URL: string;
    TB_ADDRESS: string;
    TB_CLUSTER_ID: number;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    BETTER_AUTH_TRUSTED_ORIGINS: string;
}

export function createAppContext(env: Env) {
    const logger = createConsoleLogger({ service: "bedrock-api" });
    const organizationsService = createOrganizationsService({ db, logger });
    const currenciesService = createCurrenciesService({ db, logger });

    return {
        env,
        logger,
        organizationsService,
        currenciesService,
    };
}

export type AppContext = ReturnType<typeof createAppContext>;
