import { describe, expect, it } from "vitest";

import type {
  PaymentRouteCalculation,
  PaymentRouteCalculationFee,
  PaymentRouteDraft,
} from "@bedrock/treasury/contracts";

import {
  getPaymentRouteMarginBps,
  getPaymentRouteValidationChecks,
} from "@/features/payment-routes/lib/validation";

const CUR_IN = "00000000-0000-4000-8000-000000000101";

function createDraft(): PaymentRouteDraft {
  return {
    additionalFees: [],
    amountInMinor: "100000",
    amountOutMinor: "100000",
    currencyInId: CUR_IN,
    currencyOutId: CUR_IN,
    legs: [
      {
        fees: [],
        fromCurrencyId: CUR_IN,
        id: "leg-1",
        toCurrencyId: CUR_IN,
      },
    ],
    lockedSide: "currency_in",
    participants: [
      {
        binding: "abstract",
        displayName: "Клиент",
        entityId: null,
        entityKind: null,
        nodeId: "node-source",
        requisiteId: null,
        role: "source",
      },
      {
        binding: "abstract",
        displayName: "Бенефициар",
        entityId: null,
        entityKind: null,
        nodeId: "node-destination",
        requisiteId: null,
        role: "destination",
      },
    ],
  };
}

function createFee(input: {
  amountMinor: string;
  chargeToCustomer: boolean;
  inputImpactMinor: string;
}): PaymentRouteCalculationFee {
  return {
    amountMinor: input.amountMinor,
    chargeToCustomer: input.chargeToCustomer,
    currencyId: CUR_IN,
    id: "fee-1",
    inputImpactCurrencyId: CUR_IN,
    inputImpactMinor: input.inputImpactMinor,
    kind: "gross_percent",
    outputImpactCurrencyId: CUR_IN,
    outputImpactMinor: input.inputImpactMinor,
    percentage: "1",
    routeInputImpactMinor: input.inputImpactMinor,
  };
}

function createCalculation(input: {
  additionalFees?: PaymentRouteCalculationFee[];
  amountInMinor?: string;
  legFees?: PaymentRouteCalculationFee[];
}): PaymentRouteCalculation {
  const amountInMinor = input.amountInMinor ?? "100000";
  return {
    additionalFees: input.additionalFees ?? [],
    amountInMinor,
    amountOutMinor: amountInMinor,
    chargedFeeTotals: [],
    cleanAmountOutMinor: amountInMinor,
    clientTotalInMinor: amountInMinor,
    computedAt: "2026-04-21T00:00:00.000Z",
    costPriceInMinor: amountInMinor,
    currencyInId: CUR_IN,
    currencyOutId: CUR_IN,
    feeTotals: [],
    grossAmountOutMinor: amountInMinor,
    internalFeeTotals: [],
    legs: [
      {
        asOf: "2026-04-21T00:00:00.000Z",
        fees: input.legFees ?? [],
        fromCurrencyId: CUR_IN,
        grossOutputMinor: amountInMinor,
        id: "leg-1",
        idx: 1,
        inputAmountMinor: amountInMinor,
        netOutputMinor: amountInMinor,
        rateDen: "1",
        rateNum: "1",
        rateSource: "identity",
        toCurrencyId: CUR_IN,
      },
    ],
    lockedSide: "currency_in",
    netAmountOutMinor: amountInMinor,
  };
}

describe("getPaymentRouteMarginBps", () => {
  it("returns null when calculation is missing", () => {
    expect(getPaymentRouteMarginBps(null)).toBeNull();
  });

  it("returns null when gross input is zero", () => {
    const calculation = createCalculation({ amountInMinor: "0" });
    expect(getPaymentRouteMarginBps(calculation)).toBeNull();
  });

  it("computes bps from charged leg fees", () => {
    // 1% of 100000 = 1000 → margin = 1000 input minor → bps = 1000 * 10000 / 100000 = 100
    const fee = createFee({
      amountMinor: "1000",
      chargeToCustomer: true,
      inputImpactMinor: "1000",
    });
    const calculation = createCalculation({ legFees: [fee] });
    expect(getPaymentRouteMarginBps(calculation)).toBe(100);
  });
});

describe("getPaymentRouteValidationChecks", () => {
  it("reports ok when draft, requisites, and margin are all clean", () => {
    const calculation = createCalculation({
      legFees: [
        createFee({
          amountMinor: "500",
          chargeToCustomer: true,
          inputImpactMinor: "500",
        }),
      ],
    });
    const checks = getPaymentRouteValidationChecks({
      calculation,
      draft: createDraft(),
      maxMarginBps: null,
      minMarginBps: null,
      requisiteWarnings: [],
    });

    expect(checks).toHaveLength(3);
    expect(checks.every((c) => c.status === "ok")).toBe(true);
  });

  it("flags margin below the minimum bound", () => {
    const fee = createFee({
      amountMinor: "10",
      chargeToCustomer: true,
      inputImpactMinor: "10",
    });
    const calculation = createCalculation({ legFees: [fee] });

    const checks = getPaymentRouteValidationChecks({
      calculation,
      draft: createDraft(),
      maxMarginBps: null,
      minMarginBps: null,
      requisiteWarnings: [],
    });

    const margin = checks.find((c) => c.id === "margin_policy");
    expect(margin?.status).toBe("warning");
    expect(margin?.detail).toContain("0,25% ≤ 0,01% ≤ 10%");
  });

  it("flags margin above the maximum bound", () => {
    const fee = createFee({
      amountMinor: "20000",
      chargeToCustomer: true,
      inputImpactMinor: "20000",
    });
    const calculation = createCalculation({ legFees: [fee] });

    const checks = getPaymentRouteValidationChecks({
      calculation,
      draft: createDraft(),
      maxMarginBps: 1000,
      minMarginBps: 25,
      requisiteWarnings: [],
    });

    const margin = checks.find((c) => c.id === "margin_policy");
    expect(margin?.status).toBe("warning");
    expect(margin?.detail).toContain("0,25% ≤ 20% ≤ 10%");
  });

  it("soft-skips margin when calculation is null", () => {
    const checks = getPaymentRouteValidationChecks({
      calculation: null,
      draft: createDraft(),
      maxMarginBps: null,
      minMarginBps: null,
      requisiteWarnings: [],
    });

    const margin = checks.find((c) => c.id === "margin_policy");
    expect(margin?.status).toBe("ok");
    expect(margin?.detail).toContain("после расчёта");
  });

  it("flags missing requisites", () => {
    const checks = getPaymentRouteValidationChecks({
      calculation: null,
      draft: createDraft(),
      maxMarginBps: null,
      minMarginBps: null,
      requisiteWarnings: [
        {
          createHref: null,
          message: "Нет реквизита",
          ownerKey: null,
          participantNodeId: "n",
          title: "Без реквизита",
        },
      ],
    });

    const requisites = checks.find((c) => c.id === "requisites");
    expect(requisites?.status).toBe("warning");
    expect(requisites?.detail).toContain("1");
  });
});
