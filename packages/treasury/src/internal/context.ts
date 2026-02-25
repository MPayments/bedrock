import { type CurrenciesService } from "@bedrock/currencies";
import { type Database } from "@bedrock/db";
import { type FeesService } from "@bedrock/fees";
import { type Logger, noopLogger } from "@bedrock/kernel";
import { type LedgerEngine } from "@bedrock/ledger";

export interface TreasuryServiceDeps {
    db: Database;
    ledger: LedgerEngine;
    feesService: FeesService;
    currenciesService: CurrenciesService;
    logger?: Logger;
}

export interface TreasuryServiceContext {
    db: Database;
    ledger: LedgerEngine;
    feesService: FeesService;
    currenciesService: CurrenciesService;
    log: Logger;
}

export const SYSTEM_LEDGER_ORG_ID = "00000000-0000-4000-8000-000000000001";

export function createTreasuryContext(deps: TreasuryServiceDeps): TreasuryServiceContext {
    return {
        db: deps.db,
        ledger: deps.ledger,
        feesService: deps.feesService,
        currenciesService: deps.currenciesService,
        log: deps.logger?.child({ service: "treasury" }) ?? noopLogger,
    };
}
