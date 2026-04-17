import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getTreasuryOrganizationBalances = vi.fn();
const getTreasuryBalancesEvaluationTotal = vi.fn();
const replace = vi.fn();

vi.mock("@/features/treasury/balances/lib/evaluation", () => ({
  getTreasuryBalancesEvaluationTotal,
}));

vi.mock("@/features/treasury/balances/lib/server-queries", () => ({
  getTreasuryOrganizationBalances,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/treasury/balances",
  useRouter: () => ({
    replace,
  }),
  useSearchParams: () => new URLSearchParams(""),
}));

describe("treasury balances page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getTreasuryBalancesEvaluationTotal.mockImplementation(
      async ({
        currencyAmounts,
        evaluationCurrency,
      }: {
        currencyAmounts: { amount: string; currency: string }[];
        evaluationCurrency: string;
      }) => ({
        amount: currencyAmounts[0]?.amount ?? "0",
        currency: evaluationCurrency,
        isComplete: true,
        missingCurrencies: [],
      }),
    );
  });

  it("renders the selected organization hero and keeps all organizations in one explorer", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getTreasuryOrganizationBalances.mockResolvedValue({
      asOf: "2026-04-02T10:15:00.000Z",
      data: [
        {
          organizationId: "11111111-1111-4111-8111-111111111111",
          organizationName: "Multihansa",
          requisiteId: "33333333-3333-4333-8333-333333333333",
          requisiteLabel: "USD settlement",
          requisiteIdentity: "40702810900000000001",
          currency: "USD",
          ledgerBalance: "12345.67",
          available: "12000.5",
          reserved: "300.1",
          pending: "45.07",
        },
        {
          organizationId: "11111111-1111-4111-8111-111111111111",
          organizationName: "Multihansa",
          requisiteId: "44444444-4444-4444-8444-444444444444",
          requisiteLabel: "USD reserve",
          requisiteIdentity: "40702810900000000002",
          currency: "USD",
          ledgerBalance: "2345.66",
          available: "2000.44",
          reserved: "345.22",
          pending: "0",
        },
        {
          organizationId: "22222222-2222-4222-8222-222222222222",
          organizationName: "Bedrock Treasury",
          requisiteId: "55555555-5555-4555-8555-555555555555",
          requisiteLabel: "EUR settlement",
          requisiteIdentity: "DE02120300000000202051",
          currency: "EUR",
          ledgerBalance: "9",
          available: "9",
          reserved: "0",
          pending: "0",
        },
      ],
    });

    const { default: TreasuryBalancesPage } = await import(
      "@/app/(shell)/treasury/balances/page"
    );

    const html = renderToStaticMarkup(
      await TreasuryBalancesPage({
        searchParams: Promise.resolve({
          evaluationCurrency: "USD",
          organizationId: "11111111-1111-4111-8111-111111111111",
        }),
      }),
    );

    expect(html).toContain("Multihansa");
    expect(html).toContain("Bedrock Treasury");
    expect(html).toContain("Совокупная оценка в");
    expect(html).toContain("Все счета");
    expect(html).toContain("В фокусе");
    expect(html).toContain("$14,691.33");
    expect(html).toContain("14,691.33 USD");
    expect(html).toContain("14,000.94 USD");
    expect(html).toContain("645.32 USD");
    expect(html).toContain("45.07 USD");
    expect(html).toContain("12,345.67 USD");
    expect(html).toContain("USD settlement");
    expect(html).toContain("USD reserve");
    expect(html).toContain("EUR settlement");
    expect(getTreasuryBalancesEvaluationTotal).toHaveBeenCalledWith({
      asOf: "2026-04-02T10:15:00.000Z",
      currencyAmounts: [{ amount: "14691.33", currency: "USD" }],
      evaluationCurrency: "USD",
    });
  });

  it("falls back to the first sorted organization and defaults the evaluation currency to USD", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getTreasuryOrganizationBalances.mockResolvedValue({
      asOf: "2026-04-02T10:15:00.000Z",
      data: [
        {
          organizationId: "11111111-1111-4111-8111-111111111111",
          organizationName: "Multihansa",
          requisiteId: "33333333-3333-4333-8333-333333333333",
          requisiteLabel: "USD settlement",
          requisiteIdentity: "40702810900000000001",
          currency: "USD",
          ledgerBalance: "10",
          available: "7",
          reserved: "2",
          pending: "1",
        },
        {
          organizationId: "22222222-2222-4222-8222-222222222222",
          organizationName: "Bedrock Treasury",
          requisiteId: "55555555-5555-4555-8555-555555555555",
          requisiteLabel: "EUR settlement",
          requisiteIdentity: "DE02120300000000202051",
          currency: "EUR",
          ledgerBalance: "9",
          available: "9",
          reserved: "0",
          pending: "0",
        },
      ],
    });

    const { default: TreasuryBalancesPage } = await import(
      "@/app/(shell)/treasury/balances/page"
    );

    const html = renderToStaticMarkup(
      await TreasuryBalancesPage({
        searchParams: Promise.resolve({
          evaluationCurrency: "USD",
          organizationId: "00000000-0000-4000-8000-000000000000",
        }),
      }),
    );

    expect(html).toContain("Bedrock Treasury");
    expect(html).toContain("EUR settlement");
    expect(html).toContain("$9");
    expect(html).toContain("9 EUR");
    expect(getTreasuryBalancesEvaluationTotal).toHaveBeenCalledWith({
      asOf: "2026-04-02T10:15:00.000Z",
      currencyAmounts: [{ amount: "9", currency: "EUR" }],
      evaluationCurrency: "USD",
    });
  });

  it("renders a treasury empty state when no balance rows are available", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getTreasuryOrganizationBalances.mockResolvedValue({
      asOf: "2026-04-02T10:15:00.000Z",
      data: [],
    });

    const { default: TreasuryBalancesPage } = await import(
      "@/app/(shell)/treasury/balances/page"
    );

    const html = renderToStaticMarkup(
      await TreasuryBalancesPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(html).toContain("Балансы отсутствуют");
    expect(html).toContain("Позиции казначейских организаций пока отсутствуют.");
  });
});
