import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getTreasuryOrganizationBalances = vi.fn();

vi.mock("@/features/treasury/balances/lib/queries", () => ({
  getTreasuryOrganizationBalances,
}));

describe("treasury balances page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("groups balances by organization and shows per-currency subtotals", async () => {
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
          organizationId: "11111111-1111-4111-8111-111111111111",
          organizationName: "Multihansa",
          requisiteId: "44444444-4444-4444-8444-444444444444",
          requisiteLabel: "USD reserve",
          requisiteIdentity: "40702810900000000002",
          currency: "USD",
          ledgerBalance: "5",
          available: "4",
          reserved: "1",
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

    const html = renderToStaticMarkup(await TreasuryBalancesPage());

    expect(html).toContain("Multihansa");
    expect(html).toContain("Bedrock Treasury");
    expect(html).toContain("USD · Итого");
    expect(html).toContain("15 USD");
    expect(html).toContain("11 USD");
    expect(html).toContain("3 USD");
    expect(html).toContain("1 USD");
    expect(html).toContain("USD settlement");
    expect(html).toContain("USD reserve");
    expect(html).toContain("EUR settlement");
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

    const html = renderToStaticMarkup(await TreasuryBalancesPage());

    expect(html).toContain("Балансы отсутствуют");
    expect(html).toContain("Позиции treasury-организаций пока отсутствуют.");
  });
});
