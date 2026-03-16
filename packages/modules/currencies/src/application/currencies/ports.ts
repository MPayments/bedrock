import type { Transaction } from "@bedrock/platform/persistence";

import type {
  CreateCurrencyInput,
  Currency,
  UpdateCurrencyInput,
} from "../../contracts";

export interface CurrenciesQueryRepository {
  listAll(): Promise<Currency[]>;
  findById(id: string): Promise<Currency | null>;
  findByCode(code: string): Promise<Currency | null>;
  listPrecisionsByCode(codes: string[]): Promise<Map<string, number>>;
}

export interface CurrenciesCommandRepository {
  create(input: CreateCurrencyInput, tx?: Transaction): Promise<Currency>;
  update(
    id: string,
    input: UpdateCurrencyInput,
    tx?: Transaction,
  ): Promise<Currency | null>;
  remove(id: string, tx?: Transaction): Promise<boolean>;
}
