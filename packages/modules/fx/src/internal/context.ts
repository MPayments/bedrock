import { type Logger, noopLogger } from "@bedrock/common";
import type { Database } from "@bedrock/common/db/types";

import type { FxCurrencyCatalogPort, FxQuoteFeePort } from "../ports";
import { createCbrRateSourceProvider } from "../sources/cbr";
import { createInvestingRateSourceProvider } from "../sources/investing";
import { type FxRateSource, type FxRateSourceProvider } from "../sources/types";
import { createXeRateSourceProvider } from "../sources/xe";

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
  rateSourceProviders: Record<FxRateSource, FxRateSourceProvider>;
}

export function createFxServiceContext(deps: FxServiceDeps): FxServiceContext {
  const defaultProviders: Record<FxRateSource, FxRateSourceProvider> = {
    cbr: createCbrRateSourceProvider(),
    investing: createInvestingRateSourceProvider(),
    xe: createXeRateSourceProvider(),
  };

  return {
    db: deps.db,
    feesService: deps.feesService,
    currenciesService: deps.currenciesService,
    log: deps.logger?.child({ service: "fx" }) ?? noopLogger,
    rateSourceProviders: {
      ...defaultProviders,
      ...deps.rateSourceProviders,
    },
  };
}
