import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type { FxCurrencyCatalogPort, FxQuoteFeePort } from "../ports";
import { type FxRateSource, type FxRateSourceProvider } from "../source-providers";

export interface FxServiceDeps {
  db: Database;
  feesService: FxQuoteFeePort;
  currenciesService: FxCurrencyCatalogPort;
  logger?: Logger;
  rateSourceProviders?: Partial<Record<FxRateSource, FxRateSourceProvider>>;
}

export interface FxServiceContext {
  db: Database;
  feesService: FxQuoteFeePort;
  currenciesService: FxCurrencyCatalogPort;
  log: Logger;
  rateSourceProviders: Record<FxRateSource, FxRateSourceProvider | undefined>;
}

export function createFxServiceContext(deps: FxServiceDeps): FxServiceContext {
  return {
    db: deps.db,
    feesService: deps.feesService,
    currenciesService: deps.currenciesService,
    log: deps.logger?.child({ service: "fx" }) ?? noopLogger,
    rateSourceProviders: {
      cbr: deps.rateSourceProviders?.cbr,
      investing: deps.rateSourceProviders?.investing,
      xe: deps.rateSourceProviders?.xe,
    },
  };
}
