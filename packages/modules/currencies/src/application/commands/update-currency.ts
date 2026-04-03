import {
  UpdateCurrencyInputSchema,
  type UpdateCurrencyInput,
} from "../../contracts";
import type { Currency } from "../../contracts";
import { CurrencyNotFoundError } from "../../errors";
import type { CurrenciesServiceContext } from "../shared/context";

export class UpdateCurrencyCommand {
  constructor(private readonly context: CurrenciesServiceContext) {}

  async execute(id: string, input: UpdateCurrencyInput): Promise<Currency> {
    const validated = UpdateCurrencyInputSchema.parse(input);
    const updated = await this.context.commands.update(id, validated);

    if (!updated) {
      throw new CurrencyNotFoundError(id);
    }

    this.context.cache.invalidate();
    this.context.log.info("Currency updated", {
      code: updated.code,
      id,
    });
    return updated;
  }
}
