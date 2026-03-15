import { describe, expect, it, vi } from "vitest";

const soapMocks = vi.hoisted(() => ({
    createClientAsync: vi.fn(),
}));

vi.mock("soap", () => ({
    createClientAsync: soapMocks.createClientAsync,
}));

import {
    createCbrRateSourceProvider,
    RateSourceSyncError,
} from "@bedrock/fx/providers";

describe("createCbrRateSourceProvider", () => {
    it("uses default SOAP client factory", async () => {
        soapMocks.createClientAsync.mockReset();
        soapMocks.createClientAsync.mockResolvedValue({
            GetLatestDateTimeAsync: vi.fn(async () => [
                { GetLatestDateTimeResult: "2026-02-19T00:00:00" },
            ]),
            GetCursOnDateAsync: vi.fn(async () => [
                {
                    GetCursOnDateResult: {
                        diffgram: {
                            NewDataSet: {
                                ValuteCursOnDate: [
                                    { VchCode: "USD", VunitRate: "90,00" },
                                ],
                            },
                        },
                    },
                },
            ]),
        });

        const provider = createCbrRateSourceProvider({
            baseUrl: "https://example.test/DailyInfo.asmx",
        });

        const result = await provider.fetchLatest();

        expect(result.source).toBe("cbr");
        expect(result.rates.length).toBe(2);
        expect(soapMocks.createClientAsync).toHaveBeenCalledWith(
            "https://example.test/DailyInfo.asmx?wsdl",
        );
    });

    it("parses CBR SOAP dataset and emits RUB pairs in both directions", async () => {
        const soapClient = {
            GetLatestDateTimeAsync: vi.fn(async () => [
                {},
                `<soap:Envelope><soap:Body><GetLatestDateTimeResponse><GetLatestDateTimeResult>2026-02-19T00:00:00</GetLatestDateTimeResult></GetLatestDateTimeResponse></soap:Body></soap:Envelope>`,
            ]),
            GetCursOnDateAsync: vi.fn(async () => [{
                GetCursOnDateResult: {
                    diffgram: {
                        NewDataSet: {
                            ValuteCursOnDate: [
                                {
                                    VchCode: "USD",
                                    VunitRate: "90,1234",
                                },
                                {
                                    VchCode: "EUR",
                                    Vcurs: "103,5000",
                                    Vnom: "2",
                                },
                                {
                                    VchCode: "IRR",
                                    VunitRate: "5.9709E-05",
                                },
                            ],
                        },
                    },
                },
            }]),
        };
        const soapClientFactory = vi.fn(async () => soapClient);

        const provider = createCbrRateSourceProvider({
            soapClientFactory,
            baseUrl: "https://example.test/DailyInfo.asmx",
        });

        const fetchedAt = new Date("2026-02-19T09:00:00Z");
        const result = await provider.fetchLatest(fetchedAt);

        expect(soapClientFactory).toHaveBeenCalledTimes(1);
        expect(soapClientFactory).toHaveBeenCalledWith("https://example.test/DailyInfo.asmx?wsdl");
        expect(soapClient.GetLatestDateTimeAsync).toHaveBeenCalledTimes(1);
        expect(soapClient.GetCursOnDateAsync).toHaveBeenCalledTimes(1);
        expect(soapClient.GetCursOnDateAsync).toHaveBeenCalledWith({
            On_date: "2026-02-19T00:00:00",
        });

        expect(result.source).toBe("cbr");
        expect(result.fetchedAt.toISOString()).toBe(fetchedAt.toISOString());
        expect(result.rates.length).toBe(6);

        const usdRub = result.rates.find((rate) => rate.base === "USD" && rate.quote === "RUB");
        const rubUsd = result.rates.find((rate) => rate.base === "RUB" && rate.quote === "USD");
        const eurRub = result.rates.find((rate) => rate.base === "EUR" && rate.quote === "RUB");
        const irrRub = result.rates.find((rate) => rate.base === "IRR" && rate.quote === "RUB");

        expect(usdRub).toBeTruthy();
        expect(rubUsd).toBeTruthy();
        expect(eurRub).toBeTruthy();
        expect(irrRub).toBeTruthy();

        expect(usdRub!.rateNum * rubUsd!.rateNum).toBe(usdRub!.rateDen * rubUsd!.rateDen);
        expect(eurRub!.rateNum * 4n).toBe(eurRub!.rateDen * 207n);
        expect(irrRub!.rateNum > 0n).toBe(true);
        expect(irrRub!.rateDen > 0n).toBe(true);
    });

    it("throws when CBR response has no parseable rates", async () => {
        const soapClientFactory = vi.fn(async () => ({
            GetLatestDateTimeAsync: vi.fn(async () => [{
                GetLatestDateTimeResult: "2026-02-19T00:00:00",
            }]),
            GetCursOnDateAsync: vi.fn(async () => [{
                GetCursOnDateResult: {
                    diffgram: {
                        NewDataSet: {},
                    },
                },
            }]),
        }));

        const provider = createCbrRateSourceProvider({
            soapClientFactory,
            baseUrl: "https://example.test/DailyInfo.asmx",
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });

    it("throws when GetLatestDateTime request fails", async () => {
        const soapClientFactory = vi.fn(async () => ({
            GetLatestDateTimeAsync: vi.fn(async () => {
                throw new Error("transport failure");
            }),
            GetCursOnDateAsync: vi.fn(),
        }));

        const provider = createCbrRateSourceProvider({
            soapClientFactory,
            baseUrl: "https://example.test/DailyInfo.asmx",
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });

    it("throws when latest date value is invalid", async () => {
        const soapClientFactory = vi.fn(async () => ({
            GetLatestDateTimeAsync: vi.fn(async () => [
                { GetLatestDateTimeResult: "not-a-date" },
            ]),
            GetCursOnDateAsync: vi.fn(),
        }));

        const provider = createCbrRateSourceProvider({
            soapClientFactory,
            baseUrl: "https://example.test/DailyInfo.asmx",
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });

    it("throws when GetCursOnDate request fails", async () => {
        const soapClientFactory = vi.fn(async () => ({
            GetLatestDateTimeAsync: vi.fn(async () => [
                { GetLatestDateTimeResult: "2026-02-19T00:00:00" },
            ]),
            GetCursOnDateAsync: vi.fn(async () => {
                throw new Error("timeout");
            }),
        }));

        const provider = createCbrRateSourceProvider({
            soapClientFactory,
            baseUrl: "https://example.test/DailyInfo.asmx",
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });
});
