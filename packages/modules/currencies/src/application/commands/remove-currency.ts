import { hasPostgresForeignKeyViolation } from "@bedrock/platform/persistence/postgres-errors";

import {
  CurrencyDeleteConflictError,
  CurrencyNotFoundError,
} from "../../errors";
import type { CurrenciesServiceContext } from "../shared/context";

export class RemoveCurrencyCommand {
  constructor(private readonly context: CurrenciesServiceContext) {}

  async execute(id: string): Promise<void> {
    try {
      const removed = await this.context.commands.remove(id);

      if (!removed) {
        throw new CurrencyNotFoundError(id);
      }
    } catch (error) {
      if (error instanceof CurrencyNotFoundError) {
        throw error;
      }

      if (hasPostgresForeignKeyViolation(error)) {
        throw new CurrencyDeleteConflictError(id);
      }

      throw error;
    }

    this.context.cache.invalidate();
    this.context.log.info("Currency removed", { id });
  }
}
