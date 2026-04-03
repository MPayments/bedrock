import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
  CreateCurrencyInput,
  Currency,
  UpdateCurrencyInput,
} from "../../contracts";

export interface CurrenciesQueryRepository {
  listAll(): Promise<Currency[]>;
  findById(id: string): Promise<Currency | null>;
  findByCode(code: string): Promise<Currency | null>;
  listByIds(ids: string[]): Promise<Map<string, Currency>>;
  listPrecisionsByCode(codes: string[]): Promise<Map<string, number>>;
}

export interface CurrenciesCommandRepository {
  create(input: CreateCurrencyInput, tx?: PersistenceSession): Promise<Currency>;
  update(
    id: string,
    input: UpdateCurrencyInput,
    tx?: PersistenceSession,
  ): Promise<Currency | null>;
  remove(id: string, tx?: PersistenceSession): Promise<boolean>;
}
