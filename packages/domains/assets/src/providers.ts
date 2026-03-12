import { defineProvider, LoggerToken, type Provider } from "@bedrock/core";
import {
  adaptBedrockLogger,
  DbToken,
} from "@multihansa/common/bedrock";
import { createCurrenciesServiceContext } from "./context";
import {
  createCurrency,
  createCurrencyCacheState,
  findCurrencyByCode,
  findCurrencyById,
  listCurrencies,
  removeCurrency,
  updateCurrency,
} from "./runtime";

import { CurrenciesDomainServiceToken } from "./tokens";

export function createAssetsProviders(): Provider[] {
  return [
    defineProvider({
      provide: CurrenciesDomainServiceToken,
      scope: "singleton",
      deps: {
        db: DbToken,
        logger: LoggerToken,
      },
      useFactory: ({ db, logger }) => {
        const context = createCurrenciesServiceContext({
          db,
          logger: adaptBedrockLogger(logger),
        });
        const cacheState = createCurrencyCacheState();

        return {
          list: (query?: Parameters<typeof listCurrencies>[2]) =>
            listCurrencies(context, cacheState, query),
          findById: (id: string) => findCurrencyById(context, cacheState, id),
          findByCode: (code: string) =>
            findCurrencyByCode(context, cacheState, code),
          create: (input: Parameters<typeof createCurrency>[2]) =>
            createCurrency(context, cacheState, input),
          update: (id: string, input: Parameters<typeof updateCurrency>[3]) =>
            updateCurrency(context, cacheState, id, input),
          remove: (id: string) => removeCurrency(context, cacheState, id),
        };
      },
    }),
  ];
}
