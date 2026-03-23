import {
  type ModuleRuntime,
} from "@bedrock/shared/core";

import { SetManualRateCommand } from "./commands/set-manual-rate";
import { SyncRatesFromSourceCommand } from "./commands/sync-rates-from-source";
import type { RatesRepository } from "./ports";
import { GetCrossRateQuery } from "./queries/get-cross-rate";
import { GetLatestRateQuery } from "./queries/get-latest-rate";
import { GetRateHistoryQuery } from "./queries/get-rate-history";
import { GetRateSourceStatusesQuery } from "./queries/get-rate-source-statuses";
import { ListRatePairsQuery } from "./queries/list-rate-pairs";
import type {
  CurrenciesPort,
  RateSource,
  RateSourceProvider,
} from "../../shared/application/external-ports";

export interface RatesServiceDeps {
  runtime: ModuleRuntime;
  currencies: CurrenciesPort;
  rateSourceProviders?: Partial<Record<RateSource, RateSourceProvider>>;
  ratesRepository: RatesRepository;
}

export function createRatesService(deps: RatesServiceDeps) {
  const syncRatesFromSource = new SyncRatesFromSourceCommand(
    deps.currencies,
    deps.runtime,
    deps.ratesRepository,
    deps.rateSourceProviders,
  );
  const setManualRate = new SetManualRateCommand(
    deps.runtime.now,
    deps.currencies,
    deps.ratesRepository,
    syncRatesFromSource.invalidateRateCache.bind(syncRatesFromSource),
  );

  const getLatestRate = new GetLatestRateQuery(
    deps.runtime.now,
    deps.currencies,
    syncRatesFromSource,
  );
  const getCrossRate = new GetCrossRateQuery(
    getLatestRate.execute.bind(getLatestRate),
  );
  const listPairs = new ListRatePairsQuery(deps.ratesRepository);
  const getRateHistory = new GetRateHistoryQuery(deps.ratesRepository);
  const getRateSourceStatuses = new GetRateSourceStatusesQuery(syncRatesFromSource);

  return {
    commands: {
      setManualRate: setManualRate.execute.bind(setManualRate),
      syncRatesFromSource: syncRatesFromSource.execute.bind(syncRatesFromSource),
    },
    queries: {
      getLatestRate: getLatestRate.execute.bind(getLatestRate),
      getCrossRate: getCrossRate.execute.bind(getCrossRate),
      listPairs: listPairs.execute.bind(listPairs),
      getRateHistory: getRateHistory.execute.bind(getRateHistory),
      getRateSourceStatuses:
        getRateSourceStatuses.execute.bind(getRateSourceStatuses),
    },
  };
}

export type RatesService = ReturnType<typeof createRatesService>;
