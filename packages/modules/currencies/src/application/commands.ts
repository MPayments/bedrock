import {
  CreateCurrencyInputSchema,
  UpdateCurrencyInputSchema,
  type CreateCurrencyInput,
  type Currency,
  type UpdateCurrencyInput,
} from "../contracts";
import {
  CurrencyDeleteConflictError,
  CurrencyNotFoundError,
} from "../errors";
import type { CurrenciesServiceContext } from "./shared/context";

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

export function createCreateCurrencyHandler(context: CurrenciesServiceContext) {
  const { cache, commands } = context;

  return async function createCurrency(
    input: CreateCurrencyInput,
  ): Promise<Currency> {
    const validated = CreateCurrencyInputSchema.parse(input);
    const created = await commands.create(validated);
    cache.invalidate();
    return created;
  };
}

export function createUpdateCurrencyHandler(context: CurrenciesServiceContext) {
  const { cache, commands } = context;

  return async function updateCurrency(
    id: string,
    input: UpdateCurrencyInput,
  ): Promise<Currency> {
    const validated = UpdateCurrencyInputSchema.parse(input);
    const updated = await commands.update(id, validated);

    if (!updated) {
      throw new CurrencyNotFoundError(id);
    }

    cache.invalidate();
    return updated;
  };
}

export function createRemoveCurrencyHandler(context: CurrenciesServiceContext) {
  const { cache, commands } = context;

  return async function removeCurrency(id: string): Promise<void> {
    try {
      const removed = await commands.remove(id);

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

    cache.invalidate();
  };
}
