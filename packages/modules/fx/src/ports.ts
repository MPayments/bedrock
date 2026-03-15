import type { Currency } from "@bedrock/currencies";
import type {
  CalculateFxQuoteFeeComponentsInput,
  FeeComponent,
  GetQuoteFeeComponentsInput,
  SaveQuoteFeeComponentsInput,
} from "@bedrock/fees/contracts";

export interface FxCurrencyCatalogPort {
  findById(id: string): Promise<Currency>;
  findByCode(code: string): Promise<Currency>;
}

export interface FxQuoteFeePort {
  calculateFxQuoteFeeComponents(
    input: CalculateFxQuoteFeeComponentsInput,
    tx?: unknown,
  ): Promise<FeeComponent[]>;
  getQuoteFeeComponents(
    input: GetQuoteFeeComponentsInput,
    tx?: unknown,
  ): Promise<FeeComponent[]>;
  saveQuoteFeeComponents(
    input: SaveQuoteFeeComponentsInput,
    tx?: unknown,
  ): Promise<void>;
}
