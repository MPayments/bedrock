import {
  GetRateHistoryInputSchema,
  type GetRateHistoryInput,
} from "../contracts/queries";
import type { RatesRepository } from "../ports/rates.repository";

export class GetRateHistoryQuery {
  constructor(private readonly ratesRepository: RatesRepository) {}

  async execute(input: GetRateHistoryInput) {
    const query = GetRateHistoryInputSchema.parse(input);

    return this.ratesRepository.getRateHistory(query);
  }
}
