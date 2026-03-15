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
import {
  createCurrenciesServiceContext,
  type CurrenciesServiceDeps,
} from "./application/shared/context";
import { CurrencyNotFoundError } from "./errors";

export type { CurrenciesServiceDeps } from "./application/shared/context";

export type CurrenciesService = ReturnType<typeof createCurrenciesService>;

export function createCurrenciesService(deps: CurrenciesServiceDeps) {
  const context = createCurrenciesServiceContext(deps);

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
