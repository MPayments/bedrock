import { describe, expect, it } from "vitest";

import type { PaymentRouteDraft } from "@bedrock/treasury/contracts";

import { getPaymentRouteValidationChecks } from "@/features/payment-routes/lib/validation";

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

describe("getPaymentRouteValidationChecks", () => {
  it("reports ok when draft and requisites are clean", () => {
    const checks = getPaymentRouteValidationChecks({
      calculation: null,
      draft: createDraft(),
      maxMarginBps: null,
      minMarginBps: null,
      requisiteWarnings: [],
    });

    expect(checks).toHaveLength(2);
    expect(checks.every((c) => c.status === "ok")).toBe(true);
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
