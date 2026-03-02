import { schema } from "@bedrock/modules/fx/schema";

import { type FxServiceContext } from "../../internal/context";
import { type SetManualRateInput, validateSetManualRateInput } from "../../validation";

export function createManualRateHandlers(
    context: FxServiceContext,
    deps: {
        invalidateRateCache: () => void;
    },
) {
    const { db, currenciesService } = context;

    async function setManualRate(input: SetManualRateInput) {
        const validated = validateSetManualRateInput(input);

        const { id: baseCurrencyId } = await currenciesService.findByCode(validated.base);
        const { id: quoteCurrencyId } = await currenciesService.findByCode(validated.quote);

        await db.insert(schema.fxRates).values({
            baseCurrencyId,
            quoteCurrencyId,
            rateNum: validated.rateNum,
            rateDen: validated.rateDen,
            asOf: validated.asOf,
            source: validated.source ?? "manual",
        });

        deps.invalidateRateCache();
    }

    return {
        setManualRate,
    };
}
