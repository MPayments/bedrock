import {
  CreateCurrencyInputSchema,
  type CreateCurrencyInput,
} from "../../contracts";
import type { Currency } from "../../contracts";
import type { CurrenciesServiceContext } from "../shared/context";

export class CreateCurrencyCommand {
  constructor(private readonly context: CurrenciesServiceContext) {}

  async execute(input: CreateCurrencyInput): Promise<Currency> {
    const validated = CreateCurrencyInputSchema.parse(input);
    const created = await this.context.commands.create(validated);
    this.context.cache.invalidate();
    this.context.log.info("Currency created", {
      code: created.code,
      id: created.id,
    });
    return created;
  }
}
