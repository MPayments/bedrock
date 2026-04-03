import {
  CurrencyDeleteConflictError,
  CurrencyNotFoundError,
} from "../../errors";
import type { CurrenciesServiceContext } from "../shared/context";

function hasForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "23503") {
    return true;
  }

  return hasForeignKeyViolation(candidate.cause);
}

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

      if (hasForeignKeyViolation(error)) {
        throw new CurrencyDeleteConflictError(id);
      }

      throw error;
    }

    this.context.cache.invalidate();
    this.context.log.info("Currency removed", { id });
  }
}
