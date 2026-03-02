import { describe, expect, it, vi } from "vitest";

import { schema } from "@bedrock/fx/schema";

import { RateSourceSyncError } from "../src/errors";
import { createFxService } from "../src/service";

function createCurrenciesService() {
  const byCode = new Map([
    ["USD", { id: "cur-usd", code: "USD" }],
    ["EUR", { id: "cur-eur", code: "EUR" }],
  ]);

  return {
    findByCode: vi.fn(async (code: string) => {
      const currency = byCode.get(code.trim().toUpperCase());
      if (!currency) throw new Error(`Unknown currency code: ${code}`);
      return currency;
    }),
    findById: vi.fn(async (id: string) => {
      const currency = [...byCode.values()].find((item) => item.id === id);
      if (!currency) throw new Error(`Unknown currency id: ${id}`);
      return currency;
    }),
  };
}

function createNoopFeesService() {
  return {
    calculateFxQuoteFeeComponents: vi.fn(async () => []),
    saveQuoteFeeComponents: vi.fn(async () => undefined),
    getQuoteFeeComponents: vi.fn(async () => []),
  } as any;
}

function createSourceStatusRow(overrides: Partial<any> = {}) {
  return {
    source: "cbr",
    ttlSeconds: 86400,
    lastSyncedAt: new Date("2026-01-01T00:00:00Z"),
    lastPublishedAt: new Date("2026-01-01T00:00:00Z"),
    lastStatus: "ok",
    lastError: null,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("fx source sync", () => {
  it("throws when source provider is not configured", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
      insert: vi.fn((table: unknown) => {
        if (table !== schema.fxRateSources) {
          throw new Error("unexpected table");
        }

        return {
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(async () => [createSourceStatusRow({ lastSyncedAt: null, lastStatus: "idle" })]),
            })),
          })),
        };
      }),
      execute: vi.fn(),
    } as any;

    const service = createFxService({
      db,
      feesService: createNoopFeesService(),
      currenciesService: createCurrenciesService(),
      rateSourceProviders: {
        cbr: undefined as any,
        investing: undefined as any,
      },
    });

    await expect(
      service.syncRatesFromSource({ source: "cbr", force: true, now: new Date("2026-01-02T00:00:00Z") }),
    ).rejects.toThrow(RateSourceSyncError);
  });

  it("returns unsynced when source is still fresh", async () => {
    const now = new Date("2026-01-02T00:00:00Z");
    const provider = {
      source: "cbr" as const,
      fetchLatest: vi.fn(),
    };

    const db = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (table === schema.fxRateSources) {
                return [
                  createSourceStatusRow({
                    lastSyncedAt: new Date("2026-01-01T23:59:30Z"),
                    lastPublishedAt: new Date("2026-01-01T23:59:30Z"),
                    ttlSeconds: 3600,
                  }),
                ];
              }
              return [];
            }),
          })),
          orderBy: vi.fn(async () => []),
        })),
      })),
      insert: vi.fn(),
      execute: vi.fn(),
    } as any;

    const service = createFxService({
      db,
      feesService: createNoopFeesService(),
      currenciesService: createCurrenciesService(),
      rateSourceProviders: { cbr: provider },
    });

    const result = await service.syncRatesFromSource({ source: "cbr", now });

    expect(result.synced).toBe(false);
    expect(result.rateCount).toBe(0);
    expect(provider.fetchLatest).not.toHaveBeenCalled();
  });

  it("returns default status rows when source status cache is empty", async () => {
    const now = new Date("2026-01-02T00:00:00Z");

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => []),
          })),
        })),
      })),
      insert: vi.fn(),
      execute: vi.fn(),
    } as any;

    const service = createFxService({
      db,
      feesService: createNoopFeesService(),
      currenciesService: createCurrenciesService(),
      rateSourceProviders: {
        cbr: { source: "cbr", fetchLatest: vi.fn() },
        investing: { source: "investing", fetchLatest: vi.fn() },
      },
    });

    const statuses = await service.getRateSourceStatuses(now);

    expect(statuses).toHaveLength(2);
    expect(statuses[0]!.lastStatus).toBe("idle");
    expect(statuses[0]!.isExpired).toBe(true);
  });

  it("treats investing freshness as last sync time", async () => {
    const now = new Date("2026-01-02T00:00:00Z");
    const publishedAt = new Date("2026-01-01T00:00:00Z");
    const provider = {
      source: "investing" as const,
      fetchLatest: vi.fn(async () => ({
        source: "investing" as const,
        fetchedAt: now,
        publishedAt,
        rates: [
          {
            base: "USD",
            quote: "EUR",
            rateNum: 91n,
            rateDen: 100n,
            asOf: publishedAt,
          },
        ],
      })),
    };

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
            orderBy: vi.fn(async () => []),
          })),
        })),
      })),
      insert: vi.fn((table: unknown) => {
        if (table === schema.fxRateSources) {
          return {
            values: vi.fn((value: any) => ({
              onConflictDoNothing: vi.fn(() => ({
                returning: vi.fn(async () => [
                  createSourceStatusRow({
                    source: value.source,
                    ttlSeconds: value.ttlSeconds,
                    lastSyncedAt: null,
                    lastPublishedAt: null,
                    lastStatus: value.lastStatus,
                    updatedAt: new Date("2026-01-01T00:00:00Z"),
                  }),
                ]),
              })),
              onConflictDoUpdate: vi.fn(async () => undefined),
            })),
          };
        }

        if (table === schema.fxRates) {
          return {
            values: vi.fn(() => ({
              onConflictDoUpdate: vi.fn(async () => undefined),
            })),
          };
        }

        throw new Error("unexpected table");
      }),
      execute: vi.fn(),
    } as any;

    const service = createFxService({
      db,
      feesService: createNoopFeesService(),
      currenciesService: createCurrenciesService(),
      rateSourceProviders: { investing: provider },
    });

    const result = await service.syncRatesFromSource({
      source: "investing",
      force: true,
      now,
    });

    expect(result.synced).toBe(true);
    expect(result.status.isExpired).toBe(false);
    expect(result.status.expiresAt?.toISOString()).toBe("2026-01-02T00:05:00.000Z");
  });

  it("keeps CBR freshness anchored to publication time", async () => {
    const now = new Date("2026-01-02T00:00:00Z");
    const publishedAt = new Date("2025-12-31T00:00:00Z");
    const provider = {
      source: "cbr" as const,
      fetchLatest: vi.fn(async () => ({
        source: "cbr" as const,
        fetchedAt: now,
        publishedAt,
        rates: [
          {
            base: "USD",
            quote: "EUR",
            rateNum: 91n,
            rateDen: 100n,
            asOf: publishedAt,
          },
        ],
      })),
    };

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
            orderBy: vi.fn(async () => []),
          })),
        })),
      })),
      insert: vi.fn((table: unknown) => {
        if (table === schema.fxRateSources) {
          return {
            values: vi.fn((value: any) => ({
              onConflictDoNothing: vi.fn(() => ({
                returning: vi.fn(async () => [
                  createSourceStatusRow({
                    source: value.source,
                    ttlSeconds: value.ttlSeconds,
                    lastSyncedAt: null,
                    lastPublishedAt: null,
                    lastStatus: value.lastStatus,
                    updatedAt: new Date("2026-01-01T00:00:00Z"),
                  }),
                ]),
              })),
              onConflictDoUpdate: vi.fn(async () => undefined),
            })),
          };
        }

        if (table === schema.fxRates) {
          return {
            values: vi.fn(() => ({
              onConflictDoUpdate: vi.fn(async () => undefined),
            })),
          };
        }

        throw new Error("unexpected table");
      }),
      execute: vi.fn(),
    } as any;

    const service = createFxService({
      db,
      feesService: createNoopFeesService(),
      currenciesService: createCurrenciesService(),
      rateSourceProviders: { cbr: provider },
    });

    const result = await service.syncRatesFromSource({
      source: "cbr",
      force: true,
      now,
    });

    expect(result.synced).toBe(true);
    expect(result.status.isExpired).toBe(true);
    expect(result.status.expiresAt?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
