import {
  createCreateCurrencyHandler,
  createRemoveCurrencyHandler,
  createUpdateCurrencyHandler,
} from "./application/commands";
import {
  createFindCurrencyByCodeHandler,
  createFindCurrencyByIdHandler,
  createListCurrenciesHandler,
} from "./application/queries";
import { createCurrenciesCache } from "./application/shared/cache";
import {
  createCurrenciesServiceContext,
  type CurrenciesServiceDeps,
} from "./application/shared/context";
import { CurrencyNotFoundError } from "./errors";
import {
  createDrizzleCurrenciesCommandRepository,
  createDrizzleCurrenciesQueryRepository,
} from "./infra/drizzle/repos/currencies-repository";

export type { CurrenciesServiceDeps } from "./application/shared/context";

export type CurrenciesService = ReturnType<typeof createCurrenciesService>;

export function createCurrenciesService(deps: CurrenciesServiceDeps) {
  const context = createCurrenciesServiceContext({
    commands: createDrizzleCurrenciesCommandRepository({ db: deps.db }),
    queries: createDrizzleCurrenciesQueryRepository({ db: deps.db }),
    cache: createCurrenciesCache(),
    logger: deps.logger,
  });

  const list = createListCurrenciesHandler(context);
  const findByIdRecord = createFindCurrencyByIdHandler(context);
  const findByCodeRecord = createFindCurrencyByCodeHandler(context);
  const create = createCreateCurrencyHandler(context);
  const update = createUpdateCurrencyHandler(context);
  const remove = createRemoveCurrencyHandler(context);

  async function findById(id: string) {
    const currency = await findByIdRecord(id);
    if (!currency) {
      throw new CurrencyNotFoundError(id);
    }
    return currency;
  }

  async function findByCode(code: string) {
    const currency = await findByCodeRecord(code);
    if (!currency) {
      throw new CurrencyNotFoundError(code);
    }
    return currency;
  }

  return {
    list,
    findById,
    findByCode,
    create,
    update,
    remove,
  };
}
