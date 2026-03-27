import { describe, expect, it, vi } from "vitest";

import { createTreasuryRatesWorkerDefinition } from "../src/worker";

async function runWorkerOnce(
    worker: ReturnType<typeof createTreasuryRatesWorkerDefinition>,
    now: Date = new Date("2026-02-19T00:00:00Z"),
) {
    const result = await worker.runOnce({
        now,
        signal: new AbortController().signal,
    });
    return result.processed;
}

describe("createTreasuryRatesWorkerDefinition", () => {
    it("skips non-expired sources", async () => {
        const treasuryModule = {
            pricing: {
                rates: {
                    queries: {
                        getRateSourceStatuses: vi.fn(async () => [
                            {
                                source: "cbr",
                                ttlSeconds: 86400,
                                lastSyncedAt: new Date("2026-02-19T00:00:00Z"),
                                lastPublishedAt: new Date("2026-02-19T00:00:00Z"),
                                lastStatus: "ok",
                                lastError: null,
                                expiresAt: new Date("2026-02-20T00:00:00Z"),
                                isExpired: false,
                            },
                        ]),
                    },
                    commands: {
                        syncRatesFromSource: vi.fn(async () => ({ synced: true })),
                    },
                },
            },
        } as any;

        const worker = createTreasuryRatesWorkerDefinition({ treasuryModule });
        const processed = await runWorkerOnce(
            worker,
            new Date("2026-02-19T12:00:00Z"),
        );

        expect(processed).toBe(0);
        expect(
            treasuryModule.pricing.rates.commands.syncRatesFromSource,
        ).not.toHaveBeenCalled();
    });

    it("syncs only expired sources", async () => {
        const treasuryModule = {
            pricing: {
                rates: {
                    queries: {
                        getRateSourceStatuses: vi.fn(async () => [
                            {
                                source: "cbr",
                                ttlSeconds: 86400,
                                lastSyncedAt: new Date("2026-02-17T00:00:00Z"),
                                lastPublishedAt: new Date("2026-02-17T00:00:00Z"),
                                lastStatus: "ok",
                                lastError: null,
                                expiresAt: new Date("2026-02-18T00:00:00Z"),
                                isExpired: true,
                            },
                        ]),
                    },
                    commands: {
                        syncRatesFromSource: vi.fn(async () => ({ synced: true })),
                    },
                },
            },
        } as any;

        const worker = createTreasuryRatesWorkerDefinition({ treasuryModule });
        const processed = await runWorkerOnce(
            worker,
            new Date("2026-02-19T00:00:00Z"),
        );

        expect(processed).toBe(1);
        expect(treasuryModule.pricing.rates.commands.syncRatesFromSource).toHaveBeenCalledWith({
            source: "cbr",
            now: new Date("2026-02-19T00:00:00Z"),
            force: true,
        });
    });

    it("continues processing when source sync fails", async () => {
        const logger = { error: vi.fn() } as any;
        const treasuryModule = {
            pricing: {
                rates: {
                    queries: {
                        getRateSourceStatuses: vi.fn(async () => [
                            {
                                source: "cbr",
                                ttlSeconds: 86400,
                                lastSyncedAt: null,
                                lastPublishedAt: null,
                                lastStatus: "idle",
                                lastError: null,
                                expiresAt: null,
                                isExpired: true,
                            },
                        ]),
                    },
                    commands: {
                        syncRatesFromSource: vi.fn(async () => {
                            throw new Error("boom");
                        }),
                    },
                },
            },
        } as any;

        const worker = createTreasuryRatesWorkerDefinition({
            treasuryModule,
            logger,
        });
        const processed = await runWorkerOnce(worker);

        expect(processed).toBe(0);
        expect(logger.error).toHaveBeenCalled();
    });

    it("skips source sync when per-item guard blocks source", async () => {
        const treasuryModule = {
            pricing: {
                rates: {
                    queries: {
                        getRateSourceStatuses: vi.fn(async () => [
                            {
                                source: "cbr",
                                ttlSeconds: 86400,
                                lastSyncedAt: null,
                                lastPublishedAt: null,
                                lastStatus: "idle",
                                lastError: null,
                                expiresAt: null,
                                isExpired: true,
                            },
                        ]),
                    },
                    commands: {
                        syncRatesFromSource: vi.fn(async () => ({ synced: true })),
                    },
                },
            },
        } as any;
        const beforeSourceSync = vi.fn(async () => false);

        const worker = createTreasuryRatesWorkerDefinition({
            treasuryModule,
            beforeSourceSync,
        });
        const processed = await runWorkerOnce(worker);

        expect(processed).toBe(0);
        expect(beforeSourceSync).toHaveBeenCalledTimes(1);
        expect(
            treasuryModule.pricing.rates.commands.syncRatesFromSource,
        ).not.toHaveBeenCalled();
    });
});
