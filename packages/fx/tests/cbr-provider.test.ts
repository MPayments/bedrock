import { describe, expect, it, vi } from "vitest";

import { RateSourceSyncError } from "../src/errors";
import { createCbrRateSourceProvider } from "../src/sources/cbr";

describe("createCbrRateSourceProvider", () => {
    it("parses CBR XML and emits RUB pairs in both directions", async () => {
        const fetchFn = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    `<?xml version=\"1.0\"?><GetLatestDateTimeResult>2026-02-19T00:00:00+03:00</GetLatestDateTimeResult>`,
                    { status: 200 },
                ),
            )
            .mockResolvedValueOnce(
                new Response(
                    `
                    <ValuteData>
                        <ValuteCursOnDate>
                            <VchCode>USD</VchCode>
                            <VunitRate>90,1234</VunitRate>
                        </ValuteCursOnDate>
                        <ValuteCursOnDate>
                            <VchCode>EUR</VchCode>
                            <Vcurs>103,5000</Vcurs>
                            <Vnom>2</Vnom>
                        </ValuteCursOnDate>
                    </ValuteData>
                    `,
                    { status: 200 },
                ),
            );

        const provider = createCbrRateSourceProvider({
            fetchFn,
            baseUrl: "https://example.test/DailyInfo.asmx",
        });

        const fetchedAt = new Date("2026-02-19T09:00:00Z");
        const result = await provider.fetchLatest(fetchedAt);

        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(fetchFn.mock.calls[0]?.[0]).toBe("https://example.test/DailyInfo.asmx/GetLatestDateTime");
        expect(String(fetchFn.mock.calls[1]?.[0])).toContain("GetCursOnDateXML");

        expect(result.source).toBe("cbr");
        expect(result.fetchedAt.toISOString()).toBe(fetchedAt.toISOString());
        expect(result.rates.length).toBe(4);

        const usdRub = result.rates.find((rate) => rate.base === "USD" && rate.quote === "RUB");
        const rubUsd = result.rates.find((rate) => rate.base === "RUB" && rate.quote === "USD");
        const eurRub = result.rates.find((rate) => rate.base === "EUR" && rate.quote === "RUB");

        expect(usdRub).toBeTruthy();
        expect(rubUsd).toBeTruthy();
        expect(eurRub).toBeTruthy();

        expect(usdRub!.rateNum * rubUsd!.rateNum).toBe(usdRub!.rateDen * rubUsd!.rateDen);
        expect(eurRub!.rateNum * 4n).toBe(eurRub!.rateDen * 207n);
    });

    it("throws when CBR response has no parseable rates", async () => {
        const fetchFn = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    `<?xml version=\"1.0\"?><GetLatestDateTimeResult>2026-02-19T00:00:00+03:00</GetLatestDateTimeResult>`,
                    { status: 200 },
                ),
            )
            .mockResolvedValueOnce(
                new Response(`<ValuteData></ValuteData>`, { status: 200 }),
            )
            .mockResolvedValueOnce(
                new Response(`<ValuteData></ValuteData>`, { status: 200 }),
            );

        const provider = createCbrRateSourceProvider({
            fetchFn,
            baseUrl: "https://example.test/DailyInfo.asmx",
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });
});
