import { describe, expect, it } from "vitest";

import { createDealRoutePlanSnapshot } from "../src/application/contracts/route-plan";

describe("deal route plan contracts", () => {
  it("builds a frozen route-plan snapshot from a selected template", () => {
    const snapshot = createDealRoutePlanSnapshot({
      frozenDraft: {
        additionalFees: [],
        amountInMinor: "10000",
        amountOutMinor: "9900",
        currencyInId: "00000000-0000-4000-8000-000000000001",
        currencyOutId: "00000000-0000-4000-8000-000000000001",
        legs: [
          {
            fees: [],
            fromCurrencyId: "00000000-0000-4000-8000-000000000001",
            id: "leg-1",
            toCurrencyId: "00000000-0000-4000-8000-000000000001",
          },
        ],
        lockedSide: "currency_in",
        participants: [
          {
            binding: "bound",
            displayName: "Customer",
            entityId: "00000000-0000-4000-8000-000000000010",
            entityKind: "customer",
            nodeId: "node-customer",
            requisiteId: null,
            role: "source",
          },
          {
            binding: "bound",
            displayName: "Treasury",
            entityId: "00000000-0000-4000-8000-000000000011",
            entityKind: "organization",
            nodeId: "node-org",
            requisiteId: null,
            role: "destination",
          },
        ],
      },
      lastPreview: null,
      selectedTemplate: {
        id: "00000000-0000-4000-8000-000000000100",
        name: "USD payout",
        snapshotPolicy: "clone_on_attach",
        updatedAt: "2026-04-18T12:00:00.000Z",
      },
    });

    expect(snapshot.executionSeed).toEqual({
      amountInMinor: "10000",
      amountOutMinor: "9900",
      currencyInId: "00000000-0000-4000-8000-000000000001",
      currencyOutId: "00000000-0000-4000-8000-000000000001",
      lockedSide: "currency_in",
    });
    expect(snapshot.selectedTemplate?.name).toBe("USD payout");
  });
});
