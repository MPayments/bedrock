import { sql } from "drizzle-orm";

import { schema } from "@bedrock/application/fx/schema";

import { type FxServiceContext } from "../internal/context";
import { createGetRateHistoryHandler } from "./rates/rate-history";
import { createListPairsHandler } from "./rates/list-pairs";
import { createManualRateHandlers } from "./rates/manual-rates";
import { createRateQueryHandlers } from "./rates/query";
import { createRateSourceHandlers } from "./rates/source-sync";

export function createRateHandlers(context: FxServiceContext) {
    const { db } = context;

    const sourceRates = createRateSourceHandlers(context);
    const manualRates = createManualRateHandlers(context, {
        invalidateRateCache: sourceRates.invalidateRateCache,
    });
    const queryRates = createRateQueryHandlers(context, {
        ensureSourceFresh: sourceRates.ensureSourceFresh,
        getLatestManualRate: sourceRates.getLatestManualRate,
        getLatestRateBySource: sourceRates.getLatestRateBySource,
    });
    const pairsHandler = createListPairsHandler(context);
    const historyHandler = createGetRateHistoryHandler(context);

    async function expireOldQuotes(now: Date) {
        await db.execute(sql`
            UPDATE ${schema.fxQuotes}
            SET status = 'expired'
            WHERE status = 'active'
              AND expires_at <= ${now}
        `);
    }

    return {
        ...manualRates,
        ...queryRates,
        listPairs: pairsHandler.listPairs,
        getRateHistory: historyHandler.getRateHistory,
        getRateSourceStatuses: sourceRates.getRateSourceStatuses,
        syncRatesFromSource: sourceRates.syncRatesFromSource,
        expireOldQuotes,
    };
}
