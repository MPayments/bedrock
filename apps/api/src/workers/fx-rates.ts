import dotenv from "dotenv";

import { createFxRatesWorker } from "@bedrock/fx";

import { createAppContext, type Env } from "../context";

dotenv.config({ path: "../../.env" });

const env: Env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    TB_ADDRESS: process.env.TB_ADDRESS!,
    TB_CLUSTER_ID: Number(process.env.TB_CLUSTER_ID!),
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL!,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS!,
};

const ctx = createAppContext(env);
const worker = createFxRatesWorker({
    fxService: ctx.fxService,
    logger: ctx.logger,
});

const intervalMs = Number(process.env.FX_RATES_WORKER_INTERVAL_MS ?? 60_000);
let stopped = false;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("SIGINT", () => {
    stopped = true;
});
process.on("SIGTERM", () => {
    stopped = true;
});

async function main() {
    ctx.logger.info("FX rates worker started", { intervalMs });

    while (!stopped) {
        try {
            const processed = await worker.processOnce();
            ctx.logger.debug("FX rates worker tick", { processed });
        } catch (error) {
            ctx.logger.error("FX rates worker tick failed", {
                error: error instanceof Error ? error.message : String(error),
            });
        }

        await sleep(intervalMs);
    }

    ctx.logger.info("FX rates worker stopped");
}

void main();
