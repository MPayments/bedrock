import { describe, expect, it, vi } from "vitest";

import { CompareCalculationsQuery } from "../../src/application/queries/compare-calculations";

function createCalculationDetails(input: {
  calculationId: string;
  grossRevenueInBaseMinor?: string;
  expenseAmountInBaseMinor?: string;
  netMarginInBaseMinor?: string;
  passThroughAmountInBaseMinor?: string;
  totalInBaseMinor?: string;
  totalWithExpensesInBaseMinor?: string;
  lines?: Array<{
    amountMinor: string;
    componentCode: string | null;
    currencyId?: string;
    kind:
      | "adjustment"
      | "fee_revenue"
      | "pass_through"
      | "provider_fee_expense"
      | "spread_revenue";
    routeComponentId?: string | null;
    routeLegId?: string | null;
  }>;
}) {
  const now = new Date("2026-04-14T09:00:00.000Z");

  return {
    id: input.calculationId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    currentSnapshot: {
      id: `${input.calculationId}-snapshot`,
      snapshotNumber: 1,
      agreementVersionId: null,
      agreementFeeBps: "0",
      agreementFeeAmountMinor: "0",
      calculationCurrencyId: "00000000-0000-4000-8000-000000000006",
      originalAmountMinor: "10000",
      totalFeeBps: "150",
      totalFeeAmountMinor: "150",
      totalAmountMinor: "10150",
      baseCurrencyId: "00000000-0000-4000-8000-000000000007",
      totalFeeAmountInBaseMinor: "75",
      totalInBaseMinor: input.totalInBaseMinor ?? "5000",
      dealId: "00000000-0000-4000-8000-000000000010",
      dealSnapshot: null,
      additionalExpensesCurrencyId: "00000000-0000-4000-8000-000000000007",
      additionalExpensesAmountMinor: "10",
      additionalExpensesInBaseMinor: "10",
      fixedFeeAmountMinor: "0",
      fixedFeeCurrencyId: null,
      quoteMarkupBps: "150",
      quoteMarkupAmountMinor: "150",
      routeVersionId: "00000000-0000-4000-8000-000000000150",
      routeSnapshot: null,
      referenceRateSource: null,
      referenceRateNum: null,
      referenceRateDen: null,
      referenceRateAsOf: null,
      pricingProvenance: { source: "route_estimate" },
      grossRevenueInBaseMinor: input.grossRevenueInBaseMinor ?? "75",
      expenseAmountInBaseMinor: input.expenseAmountInBaseMinor ?? "70",
      passThroughAmountInBaseMinor: input.passThroughAmountInBaseMinor ?? "10",
      netMarginInBaseMinor: input.netMarginInBaseMinor ?? "5",
      state: "draft" as const,
      totalWithExpensesInBaseMinor:
        input.totalWithExpensesInBaseMinor ?? "5085",
      rateSource: "manual" as const,
      rateNum: "1",
      rateDen: "2",
      additionalExpensesRateSource: "manual" as const,
      additionalExpensesRateNum: "1",
      additionalExpensesRateDen: "2",
      calculationTimestamp: now,
      fxQuoteId: null,
      quoteSnapshot: null,
      createdAt: now,
      updatedAt: now,
    },
    lines:
      input.lines?.map((line, idx) => ({
        basisAmountMinor: null,
        basisType: null,
        classification:
          line.kind === "provider_fee_expense"
            ? ("expense" as const)
            : line.kind === "pass_through"
              ? ("pass_through" as const)
              : ("revenue" as const),
        componentCode: line.componentCode,
        componentFamily: line.componentCode,
        id: `${input.calculationId}-line-${idx}`,
        idx,
        kind: line.kind,
        currencyId:
          line.currencyId ?? "00000000-0000-4000-8000-000000000007",
        dealId: "00000000-0000-4000-8000-000000000010",
        formulaType: null,
        inputBps: null,
        inputFixedAmountMinor: null,
        inputManualAmountMinor: null,
        inputPerMillion: null,
        amountMinor: line.amountMinor,
        routeComponentId: line.routeComponentId ?? null,
        routeLegId: line.routeLegId ?? null,
        routeVersionId: "00000000-0000-4000-8000-000000000150",
        sourceKind: "system" as const,
        createdAt: now,
        updatedAt: now,
      })) ?? [],
  };
}

describe("compare calculations query", () => {
  it("compares totals and route-component keyed line diffs", async () => {
    const reads = {
      findById: vi.fn(),
      list: vi.fn(),
    };
    const query = new CompareCalculationsQuery(reads as any);
    const left = createCalculationDetails({
      calculationId: "calc-left",
      lines: [
        {
          amountMinor: "150",
          componentCode: "client_markup",
          kind: "spread_revenue",
          routeComponentId: "component-markup",
        },
        {
          amountMinor: "20",
          componentCode: "wire_fee",
          kind: "provider_fee_expense",
          routeComponentId: "component-wire",
        },
      ],
    });
    const right = createCalculationDetails({
      calculationId: "calc-right",
      expenseAmountInBaseMinor: "60",
      grossRevenueInBaseMinor: "70",
      netMarginInBaseMinor: "10",
      passThroughAmountInBaseMinor: "12",
      totalInBaseMinor: "4900",
      totalWithExpensesInBaseMinor: "4982",
      lines: [
        {
          amountMinor: "100",
          componentCode: "client_markup",
          kind: "spread_revenue",
          routeComponentId: "component-markup",
        },
      ],
    });

    reads.findById.mockImplementation(async (id: string) => {
      if (id === left.id) {
        return left;
      }

      if (id === right.id) {
        return right;
      }

      return null;
    });

    const result = await query.execute({
      leftCalculationId: left.id,
      rightCalculationId: right.id,
    });

    expect(result.totals.grossRevenueInBaseMinor).toEqual({
      deltaMinor: "5",
      leftMinor: "75",
      rightMinor: "70",
    });
    expect(result.totals.expenseAmountInBaseMinor).toEqual({
      deltaMinor: "10",
      leftMinor: "70",
      rightMinor: "60",
    });
    expect(result.lineDiffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          componentCode: "client_markup",
          deltaAmountMinor: "50",
          leftAmountMinor: "150",
          rightAmountMinor: "100",
          routeComponentId: "component-markup",
        }),
        expect.objectContaining({
          componentCode: "wire_fee",
          deltaAmountMinor: "20",
          leftAmountMinor: "20",
          rightAmountMinor: "0",
          routeComponentId: "component-wire",
        }),
      ]),
    );
  });
});
