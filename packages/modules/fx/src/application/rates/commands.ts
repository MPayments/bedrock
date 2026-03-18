import { createRateSourceLifecycle } from "./source-lifecycle";
import type { FxServiceContext } from "../shared/context";
import {
  type SetManualRateInput,
  validateSetManualRateInput,
} from "../validation";

export function createFxRateCommandHandlers(context: FxServiceContext) {
  const { currenciesService, ratesRepository } = context;
  const lifecycle = createRateSourceLifecycle(context);

  async function setManualRate(input: SetManualRateInput): Promise<void> {
    const validated = validateSetManualRateInput(input);
    const { id: baseCurrencyId } = await currenciesService.findByCode(
      validated.base,
    );
    const { id: quoteCurrencyId } = await currenciesService.findByCode(
      validated.quote,
    );

    await ratesRepository.insertManualRate({
      baseCurrencyId,
      quoteCurrencyId,
      rateNum: validated.rateNum,
      rateDen: validated.rateDen,
      asOf: validated.asOf,
      source: validated.source ?? "manual",
    });

    lifecycle.invalidateRateCache();
  }

  async function expireOldQuotes(now: Date): Promise<void> {
    await context.quotesRepository.expireOldQuotes(now);
  }

  return {
    setManualRate,
    syncRatesFromSource: lifecycle.syncRatesFromSource,
    expireOldQuotes,
    getRateSourceStatuses: lifecycle.getRateSourceStatuses,
    ensureSourceFresh: lifecycle.ensureSourceFresh,
    getLatestRateBySource: lifecycle.getLatestRateBySource,
    getLatestManualRate: lifecycle.getLatestManualRate,
    invalidateRateCache: lifecycle.invalidateRateCache,
  };
}
