import {
    createAccountService,
    type AccountService,
} from "@bedrock/accounts";
import {
    createCounterpartiesService,
    type CounterpartiesService,
} from "@bedrock/counterparties";
import { createCustomersService, type CustomersService } from "@bedrock/customers";
import { createCurrenciesService, type CurrenciesService } from "@bedrock/currencies";
import { db } from "@bedrock/db/client";
import { createFeesService, type FeesService } from "@bedrock/fees";
import { createFxService, type FxService } from "@bedrock/fx";
import { createConsoleLogger, type Logger } from "@bedrock/kernel";

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
    accountService: AccountService;
    counterpartiesService: CounterpartiesService;
    customersService: CustomersService;
    currenciesService: CurrenciesService;
    feesService: FeesService;
    fxService: FxService;
}

export function createAppContext(env: Env): AppContext {
    const logger = createConsoleLogger({ service: "bedrock-api" });
    const accountService = createAccountService({ db, logger });
    const counterpartiesService = createCounterpartiesService({ db, logger });
    const customersService = createCustomersService({ db, logger });
    const currenciesService = createCurrenciesService({ db, logger });
    const feesService = createFeesService({ db, logger, currenciesService });
    const fxService = createFxService({ db, logger, feesService, currenciesService });

    return {
        env,
        logger,
        accountService,
        counterpartiesService,
        customersService,
        currenciesService,
        feesService,
        fxService,
    };
}
