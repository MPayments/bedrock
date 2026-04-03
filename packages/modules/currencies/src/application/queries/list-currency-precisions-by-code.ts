import type { CurrenciesQueriesContext } from "../shared/context";

export class ListCurrencyPrecisionsByCodeQuery {
  constructor(private readonly context: CurrenciesQueriesContext) {}

  async execute(codes: string[]): Promise<Map<string, number>> {
    const uniqueCodes = Array.from(
      new Set(codes.map((code) => code.trim()).filter(Boolean)),
    );

    if (uniqueCodes.length === 0) {
      return new Map();
    }

    return this.context.queries.listPrecisionsByCode(uniqueCodes);
  }
}
