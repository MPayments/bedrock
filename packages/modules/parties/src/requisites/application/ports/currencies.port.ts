import type { CurrenciesService } from "@bedrock/currencies";

export interface RequisitesCurrenciesPort {
  assertCurrencyExists(id: string): Promise<void>;
  findByCode(code: string): ReturnType<CurrenciesService["findByCode"]>;
  listCodesById(ids: string[]): Promise<Map<string, string>>;
}
