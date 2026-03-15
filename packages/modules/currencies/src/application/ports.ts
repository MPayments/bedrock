import type { Queryable } from "@bedrock/platform/persistence";

import type {
  CreateCurrencyInput,
  Currency,
  UpdateCurrencyInput,
} from "../contracts";

export interface CurrenciesRepositoryPort {
  listAll(executor?: Queryable): Promise<Currency[]>;
  findById(id: string, executor?: Queryable): Promise<Currency | null>;
  findByCode(code: string, executor?: Queryable): Promise<Currency | null>;
  create(input: CreateCurrencyInput, executor?: Queryable): Promise<Currency>;
  update(
    id: string,
    input: UpdateCurrencyInput,
    executor?: Queryable,
  ): Promise<Currency | null>;
  remove(id: string, executor?: Queryable): Promise<boolean>;
  listPrecisionsByCode(codes: string[], executor?: Queryable): Promise<Map<string, number>>;
}
