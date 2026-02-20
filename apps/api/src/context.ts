import { createCurrenciesService, type CurrenciesService } from "@bedrock/currencies";
import { db } from "@bedrock/db/client";
import { createFeesService, type FeesService } from "@bedrock/fees";
import { createFxService, type FxService } from "@bedrock/fx";
import { createConsoleLogger, type Logger } from "@bedrock/kernel";
import { createOrganizationsService, type OrganizationsService } from "@bedrock/organizations";

export interface Env {
    DATABASE_URL: string;
    TB_ADDRESS: string;
    TB_CLUSTER_ID: number;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    BETTER_AUTH_TRUSTED_ORIGINS: string;
}

export interface AppContext {
    env: Env;
    logger: Logger;
    organizationsService: OrganizationsService;
    currenciesService: CurrenciesService;
    feesService: FeesService;
    fxService: FxService;
}

export function createAppContext(env: Env): AppContext {
    const logger = createConsoleLogger({ service: "bedrock-api" });
    const organizationsService = createOrganizationsService({ db, logger });
    const currenciesService = createCurrenciesService({ db, logger });
    const feesService = createFeesService({ db, logger, currenciesService });
    const fxService = createFxService({ db, logger, feesService, currenciesService });

    return {
        env,
        logger,
        organizationsService,
        currenciesService,
        feesService,
        fxService,
    };
}
