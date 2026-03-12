import { describe, expect, it, vi } from "vitest";

import { createFxRatesWorkerDefinition } from "../../src/fx/worker";

async function runWorkerOnce(
    worker: ReturnType<typeof createFxRatesWorkerDefinition>,
    now: Date = new Date("2026-02-19T00:00:00Z"),
) {
    const result = await worker.runOnce({
        now,
        signal: new AbortController().signal,
    });
    return result.processed;
}

describe("createFxRatesWorkerDefinition", () => {
    it("skips non-expired sources", async () => {
        const fxService = {
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
            syncRatesFromSource: vi.fn(async () => ({ synced: true })),
        } as any;

        const worker = createFxRatesWorkerDefinition({ fxService });
        const processed = await runWorkerOnce(
            worker,
            new Date("2026-02-19T12:00:00Z"),
        );

        expect(processed).toBe(0);
        expect(fxService.syncRatesFromSource).not.toHaveBeenCalled();
    });

    it("syncs only expired sources", async () => {
        const fxService = {
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
            syncRatesFromSource: vi.fn(async () => ({ synced: true })),
        } as any;

        const worker = createFxRatesWorkerDefinition({ fxService });
        const processed = await runWorkerOnce(
            worker,
            new Date("2026-02-19T00:00:00Z"),
        );

        expect(processed).toBe(1);
        expect(fxService.syncRatesFromSource).toHaveBeenCalledWith({
            source: "cbr",
            now: new Date("2026-02-19T00:00:00Z"),
            force: true,
        });
    });

    it("continues processing when source sync fails", async () => {
        const logger = { error: vi.fn() } as any;
        const fxService = {
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
            syncRatesFromSource: vi.fn(async () => {
                throw new Error("boom");
            }),
        } as any;

        const worker = createFxRatesWorkerDefinition({ fxService, logger });
        const processed = await runWorkerOnce(worker);

        expect(processed).toBe(0);
        expect(logger.error).toHaveBeenCalled();
    });

    it("skips source sync when per-item guard blocks source", async () => {
        const fxService = {
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
            syncRatesFromSource: vi.fn(async () => ({ synced: true })),
        } as any;
        const beforeSourceSync = vi.fn(async () => false);

        const worker = createFxRatesWorkerDefinition({
            fxService,
            beforeSourceSync,
        });
        const processed = await runWorkerOnce(worker);

        expect(processed).toBe(0);
        expect(beforeSourceSync).toHaveBeenCalledTimes(1);
        expect(fxService.syncRatesFromSource).not.toHaveBeenCalled();
    });
});
