import { type Logger } from "@bedrock/kernel";

import { type FxService } from "./service";
import { type FxRateSource } from "./sources";

export function createFxRatesWorker(deps: { fxService: FxService; logger?: Logger }) {
    const { fxService, logger } = deps;

    async function processOnce(opts?: { now?: Date }) {
        const now = opts?.now ?? new Date();
        const statuses = await fxService.getRateSourceStatuses(now);

        let processed = 0;
        for (const status of statuses) {
            if (!status.isExpired) continue;

            try {
                await fxService.syncRatesFromSource({
                    source: status.source as FxRateSource,
                    now,
                    force: true,
                });
                processed++;
            } catch (error) {
                logger?.error("FX source sync failed", {
                    source: status.source,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return processed;
    }

    return {
        processOnce,
    };
}
