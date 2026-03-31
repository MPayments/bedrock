import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import {
  CreateCurrencyCommand,
  RemoveCurrencyCommand,
  UpdateCurrencyCommand,
} from "./application/commands";
import {
  FindCurrencyByCodeQuery,
  FindCurrencyByIdQuery,
  ListCurrenciesQuery,
} from "./application/queries";
import { createCurrenciesCache } from "./application/shared/cache";
import {
  createCurrenciesServiceContext,
} from "./application/shared/context";
import { CurrencyNotFoundError } from "./errors";
import {
  createDrizzleCurrenciesCommandRepository,
  createDrizzleCurrenciesQueryRepository,
} from "./infra/drizzle/repos/currencies-repository";

export interface CurrenciesServiceDeps {
  db: Database;
  logger?: Logger;
}

export type CurrenciesService = ReturnType<typeof createCurrenciesService>;

export function createCurrenciesService(deps: CurrenciesServiceDeps) {
  const context = createCurrenciesServiceContext({
    commands: createDrizzleCurrenciesCommandRepository({ db: deps.db }),
    queries: createDrizzleCurrenciesQueryRepository({ db: deps.db }),
    cache: createCurrenciesCache(),
    logger: deps.logger,
  });

  const listCurrencies = new ListCurrenciesQuery(context);
  const findCurrencyById = new FindCurrencyByIdQuery(context);
  const findCurrencyByCode = new FindCurrencyByCodeQuery(context);
  const createCurrency = new CreateCurrencyCommand(context);
  const updateCurrency = new UpdateCurrencyCommand(context);
  const removeCurrency = new RemoveCurrencyCommand(context);

  async function findById(id: string) {
    const currency = await findCurrencyById.execute(id);
    if (!currency) {
      throw new CurrencyNotFoundError(id);
    }
    return currency;
  }

  async function findByCode(code: string) {
    const currency = await findCurrencyByCode.execute(code);
    if (!currency) {
      throw new CurrencyNotFoundError(code);
    }
    return currency;
  }

  return {
    list: listCurrencies.execute.bind(listCurrencies),
    findById,
    findByCode,
    create: createCurrency.execute.bind(createCurrency),
    update: updateCurrency.execute.bind(updateCurrency),
    remove: removeCurrency.execute.bind(removeCurrency),
  };
}
