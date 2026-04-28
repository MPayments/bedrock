import { describe, expect, it } from "vitest";

import {
  buildTreasuryBalancesDashboardViewModel,
  resolveTreasuryBalancesEvaluationCurrency,
  resolveTreasuryBalancesOrganizationId,
} from "@/features/treasury/balances/lib/presenter";

describe("treasury balances presenter", () => {
  const snapshot = {
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
        inventoryAvailable: "0",
        inventoryReconciliationStatus: "matched" as const,
        inventoryReserved: "0",
        reserved: "2",
        pending: "1",
      },
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        organizationName: "Multihansa",
        requisiteId: "44444444-4444-4444-8444-444444444444",
        requisiteLabel: "EUR reserve",
        requisiteIdentity: "40702810900000000002",
        currency: "EUR",
        ledgerBalance: "5",
        available: "4",
        inventoryAvailable: "0",
        inventoryReconciliationStatus: "matched" as const,
        inventoryReserved: "0",
        reserved: "1",
        pending: "0",
      },
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        organizationName: "Multihansa",
        requisiteId: "55555555-5555-4555-8555-555555555555",
        requisiteLabel: "USD reserve",
        requisiteIdentity: "40702810900000000003",
        currency: "USD",
        ledgerBalance: "3",
        available: "2",
        inventoryAvailable: "0",
        inventoryReconciliationStatus: "matched" as const,
        inventoryReserved: "0",
        reserved: "1",
        pending: "0",
      },
      {
        organizationId: "22222222-2222-4222-8222-222222222222",
        organizationName: "Bedrock Treasury",
        requisiteId: "66666666-6666-4666-8666-666666666666",
        requisiteLabel: "GBP settlement",
        requisiteIdentity: "DE02120300000000202051",
        currency: "GBP",
        ledgerBalance: "9",
        available: "9",
        inventoryAvailable: "0",
        inventoryReconciliationStatus: "matched" as const,
        inventoryReserved: "0",
        reserved: "0",
        pending: "0",
      },
    ],
  };

  it("resolves the requested organization or falls back to the first sorted one", () => {
    expect(
      resolveTreasuryBalancesOrganizationId(
        snapshot.data,
        "11111111-1111-4111-8111-111111111111",
      ),
    ).toBe("11111111-1111-4111-8111-111111111111");

    expect(
      resolveTreasuryBalancesOrganizationId(
        snapshot.data,
        "00000000-0000-4000-8000-000000000000",
      ),
    ).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("resolves the evaluation currency within the selected organization and defaults to USD", () => {
    expect(
      resolveTreasuryBalancesEvaluationCurrency(
        snapshot.data,
        "11111111-1111-4111-8111-111111111111",
        "eur",
      ),
    ).toBe("EUR");

    expect(
      resolveTreasuryBalancesEvaluationCurrency(
        snapshot.data,
        "11111111-1111-4111-8111-111111111111",
        "gbp",
      ),
    ).toBe("USD");

    expect(
      resolveTreasuryBalancesEvaluationCurrency(
        snapshot.data,
        "22222222-2222-4222-8222-222222222222",
      ),
    ).toBe("USD");
  });

  it("builds a dashboard model with sorted organizations, grouped accounts, and per-currency metrics", () => {
    const viewModel = buildTreasuryBalancesDashboardViewModel(
      snapshot,
      {
        selectedEvaluationCurrency: "EUR",
        selectedOrganizationId: "11111111-1111-4111-8111-111111111111",
        totalEvaluation: {
          amount: "17.1",
          currency: "EUR",
          isComplete: true,
          missingCurrencies: [],
        },
      },
    );

    expect(viewModel).not.toBeNull();
    expect(viewModel?.organizationOptions.map((item) => item.organizationName)).toEqual([
      "Bedrock Treasury",
      "Multihansa",
    ]);
    expect(viewModel?.selectedOrganizationSummary.organizationName).toBe(
      "Multihansa",
    );
    expect(viewModel?.selectedOrganizationSummary.requisitesCount).toBe(3);
    expect(viewModel?.selectedOrganizationSummary.currencyCount).toBe(2);
    expect(viewModel?.selectedOrganizationSummary.evaluationCurrency).toBe(
      "EUR",
    );
    expect(
      viewModel?.selectedOrganizationSummary.evaluationCurrencyOptions,
    ).toEqual([
      { currency: "USD", toneIndex: 0 },
      { currency: "EUR", toneIndex: 1 },
    ]);
    expect(viewModel?.selectedOrganizationSummary.totalEvaluation).toEqual({
      amount: "17.1",
      currency: "EUR",
      isComplete: true,
      missingCurrencies: [],
    });
    expect(viewModel?.selectedOrganizationMetrics[0]?.values).toEqual([
      { amount: "13", currency: "USD", toneIndex: 0 },
      { amount: "5", currency: "EUR", toneIndex: 1 },
    ]);
    expect(viewModel?.allOrganizationAccountGroups).toHaveLength(2);
    expect(
      viewModel?.allOrganizationAccountGroups[1]?.rows.map(
        (row) => row.requisiteLabel,
      ),
    ).toEqual(["EUR reserve", "USD settlement", "USD reserve"]);
    expect(viewModel?.allAccountsRows).toHaveLength(4);
  });

  it("adds USD to evaluation options even when the organization has no USD balances", () => {
    const viewModel = buildTreasuryBalancesDashboardViewModel(snapshot, {
      selectedOrganizationId: "22222222-2222-4222-8222-222222222222",
    });

    expect(viewModel?.selectedOrganizationSummary.evaluationCurrency).toBe(
      "USD",
    );
    expect(
      viewModel?.selectedOrganizationSummary.evaluationCurrencyOptions,
    ).toEqual([
      { currency: "USD", toneIndex: 0 },
      { currency: "GBP", toneIndex: 2 },
    ]);
  });

  it("keeps the same tone for the same currency across organizations", () => {
    const viewModel = buildTreasuryBalancesDashboardViewModel(
      {
        asOf: "2026-04-02T10:15:00.000Z",
        data: [
          {
            organizationId: "11111111-1111-4111-8111-111111111111",
            organizationName: "Multihansa",
            requisiteId: "33333333-3333-4333-8333-333333333333",
            requisiteLabel: "RUB settlement",
            requisiteIdentity: "40702810900000000001",
            currency: "RUB",
            ledgerBalance: "10",
            available: "10",
            inventoryAvailable: "0",
            inventoryReconciliationStatus: "matched" as const,
            inventoryReserved: "0",
            reserved: "0",
            pending: "0",
          },
          {
            organizationId: "22222222-2222-4222-8222-222222222222",
            organizationName: "Arabian Fuel Alliance",
            requisiteId: "44444444-4444-4444-8444-444444444444",
            requisiteLabel: "RUB reserve",
            requisiteIdentity: "40702810900000000002",
            currency: "RUB",
            ledgerBalance: "5",
            available: "5",
            inventoryAvailable: "0",
            inventoryReconciliationStatus: "matched" as const,
            inventoryReserved: "0",
            reserved: "0",
            pending: "0",
          },
          {
            organizationId: "22222222-2222-4222-8222-222222222222",
            organizationName: "Arabian Fuel Alliance",
            requisiteId: "55555555-5555-4555-8555-555555555555",
            requisiteLabel: "AED settlement",
            requisiteIdentity: "40702810900000000003",
            currency: "AED",
            ledgerBalance: "7",
            available: "7",
            inventoryAvailable: "0",
            inventoryReconciliationStatus: "matched" as const,
            inventoryReserved: "0",
            reserved: "0",
            pending: "0",
          },
        ],
      },
      {
        selectedOrganizationId: "11111111-1111-4111-8111-111111111111",
      },
    );

    expect(
      viewModel?.allAccountsRows
        .filter((row) => row.currency === "RUB")
        .map((row) => row.toneIndex),
    ).toEqual([4, 4]);
    expect(
      viewModel?.allAccountsRows
        .filter((row) => row.currency === "AED")
        .map((row) => row.toneIndex),
    ).toEqual([3]);
  });
});
