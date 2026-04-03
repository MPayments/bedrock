import type { RatesRepository } from "../ports/rates.repository";

export class ListRatePairsQuery {
  constructor(private readonly ratesRepository: RatesRepository) {}

  async execute() {
    return this.ratesRepository.listPairs();
  }
}
