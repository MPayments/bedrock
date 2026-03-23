import type { Clock } from "@bedrock/shared/core";

import type { CurrenciesPort } from "../../../shared/application/external-ports";
import {
  SetManualRateInputSchema,
  type SetManualRateInput,
} from "../contracts/commands";
import type { RatesRepository } from "../ports/rates.repository";

export class SetManualRateCommand {
  constructor(
    private readonly now: Clock,
    private readonly currencies: CurrenciesPort,
    private readonly ratesRepository: RatesRepository,
    private readonly invalidateRateCache: () => void,
  ) {}

  async execute(input: SetManualRateInput): Promise<void> {
    const validated = SetManualRateInputSchema.parse(input);
    const { id: baseCurrencyId } = await this.currencies.findByCode(
      validated.base,
    );
    const { id: quoteCurrencyId } = await this.currencies.findByCode(
      validated.quote,
    );

    await this.ratesRepository.insertManualRate({
      baseCurrencyId,
      quoteCurrencyId,
      rateNum: validated.rateNum,
      rateDen: validated.rateDen,
      asOf: validated.asOf ?? this.now(),
      source: validated.source ?? "manual",
    });

    this.invalidateRateCache();
  }
}
