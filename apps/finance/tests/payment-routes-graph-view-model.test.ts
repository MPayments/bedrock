import { describe, expect, it, vi } from "vitest";

import {
  buildPaymentRouteGraphEdges,
  buildPaymentRouteGraphNodes,
} from "@/features/payment-routes/lib/graph-view-model";
import type { PaymentRouteConstructorOptions } from "@/features/payment-routes/lib/queries";
import {
  applyCalculation,
  createPaymentRouteSeed,
  insertIntermediateParticipant,
  setParticipantBinding,
  setParticipantRequisiteId,
} from "@/features/payment-routes/lib/state";

const OPTIONS: PaymentRouteConstructorOptions = {
  counterparties: [
    {
      id: "00000000-0000-4000-8000-000000000003",
      label: "Core Bank",
      shortName: "Core Bank",
    },
  ],
  currencies: [
    {
      code: "USD",
      id: "00000000-0000-4000-8000-000000000101",
      label: "USD - US Dollar",
      name: "US Dollar",
      precision: 2,
    },
    {
      code: "EUR",
      id: "00000000-0000-4000-8000-000000000102",
      label: "EUR - Euro",
      name: "Euro",
      precision: 2,
    },
  ],
  customers: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      label: "Acme Customer",
      name: "Acme Customer",
    },
  ],
  organizations: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      label: "Bedrock Treasury",
      shortName: "Bedrock Treasury",
    },
  ],
};

describe("payment route graph view model", () => {
  it("builds source, hop, and destination nodes with stable roles and subtitles", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;
    const withHop = insertIntermediateParticipant({
      afterLegIndex: 0,
      options: OPTIONS,
      state: seed,
    });
    const onInsertAfter = vi.fn();
    const onRemove = vi.fn();
    const selectedNodeId = withHop.draft.participants[1]!.nodeId;

    const nodes = buildPaymentRouteGraphNodes({
      canInsertHop: true,
      onInsertAfter,
      onRemove,
      options: OPTIONS,
      requisitesByOwner: {},
      selectedNodeId,
      state: withHop,
    });

    expect(nodes).toHaveLength(3);
    expect(nodes[0]?.data).toMatchObject({
      canRemove: false,
      displayName: "Клиент",
      iconKind: "customer",
      role: "source",
      subtitle: "Клиент",
    });
    expect(nodes[1]?.data).toMatchObject({
      canInsertAfter: true,
      canRemove: true,
      iconKind: "organization",
      role: "hop",
      subtitle: "Организация",
    });
    expect(nodes[1]?.selected).toBe(true);
    expect(nodes[2]?.data).toMatchObject({
      canInsertAfter: false,
      canRemove: false,
      displayName: "Бенефициар",
      iconKind: "beneficiary",
      role: "destination",
      subtitle: "Бенефициар",
    });
  });

  it("builds edge labels from the calculator output without changing graph semantics", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;
    const leg = seed.draft.legs[0]!;
    const calculated = applyCalculation(seed, {
      additionalFees: [],
      amountInMinor: "1200000",
      amountOutMinor: "1188000",
      computedAt: "2026-04-16T08:00:00.000Z",
      currencyInId: OPTIONS.currencies[0]!.id,
      currencyOutId: OPTIONS.currencies[0]!.id,
      feeTotals: [
        {
          amountMinor: "12000",
          currencyId: OPTIONS.currencies[0]!.id,
        },
      ],
      grossAmountOutMinor: "1200000",
      legs: [
        {
          asOf: "2026-04-16T08:00:00.000Z",
          fees: [
            {
              amountMinor: "12000",
              currencyId: OPTIONS.currencies[0]!.id,
              id: "fee-1",
              inputImpactCurrencyId: OPTIONS.currencies[0]!.id,
              inputImpactMinor: "12000",
              kind: "fixed",
              label: "Bank fee",
              outputImpactCurrencyId: OPTIONS.currencies[0]!.id,
              outputImpactMinor: "12000",
            },
          ],
          fromCurrencyId: OPTIONS.currencies[0]!.id,
          grossOutputMinor: "1200000",
          id: leg.id,
          idx: 1,
          inputAmountMinor: "1200000",
          kind: "transfer",
          netOutputMinor: "1188000",
          rateDen: "1",
          rateNum: "1",
          rateSource: "identity",
          toCurrencyId: OPTIONS.currencies[0]!.id,
        },
      ],
      lockedSide: "currency_in",
      netAmountOutMinor: "1188000",
    });

    const edges = buildPaymentRouteGraphEdges({
      options: OPTIONS,
      requisitesByOwner: {},
      selectedLegId: leg.id,
      state: calculated,
    });

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      animated: true,
      id: leg.id,
      selected: true,
      type: "routeLeg",
    });
    expect(edges[0]?.data).toMatchObject({
      amountLabel: "Сумма: 11880 USD",
      feeLabel: "Bank fee 120 USD",
      legId: leg.id,
    });
  });

  it("attaches graph edges only to the selected requisite row", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;
    const boundDestination = setParticipantBinding({
      binding: "bound",
      index: 1,
      options: OPTIONS,
      state: seed,
    });
    const selected = setParticipantRequisiteId({
      index: 1,
      requisiteId: "00000000-0000-4000-8000-000000000911",
      state: boundDestination,
    });

    const nodes = buildPaymentRouteGraphNodes({
      canInsertHop: false,
      onInsertAfter: vi.fn(),
      onRemove: vi.fn(),
      options: OPTIONS,
      requisitesByOwner: {
        [`organization:${OPTIONS.organizations[0]!.id}`]: [
          {
            currencyCode: "USD",
            currencyId: OPTIONS.currencies[0]!.id,
            id: "00000000-0000-4000-8000-000000000911",
            identity: "Main account",
            isDefault: true,
            kind: "bank",
            kindLabel: "Банк",
            label: "USD main",
            ownerId: OPTIONS.organizations[0]!.id,
            ownerType: "organization",
          },
          {
            currencyCode: "EUR",
            currencyId: OPTIONS.currencies[1]!.id,
            id: "00000000-0000-4000-8000-000000000912",
            identity: "Euro account",
            isDefault: false,
            kind: "bank",
            kindLabel: "Банк",
            label: "EUR alt",
            ownerId: OPTIONS.organizations[0]!.id,
            ownerType: "organization",
          },
        ],
      },
      selectedNodeId: null,
      state: selected,
    });
    const edges = buildPaymentRouteGraphEdges({
      options: OPTIONS,
      requisitesByOwner: {
        [`organization:${OPTIONS.organizations[0]!.id}`]: [
          {
            currencyCode: "USD",
            currencyId: OPTIONS.currencies[0]!.id,
            id: "00000000-0000-4000-8000-000000000911",
            identity: "Main account",
            isDefault: true,
            kind: "bank",
            kindLabel: "Банк",
            label: "USD main",
            ownerId: OPTIONS.organizations[0]!.id,
            ownerType: "organization",
          },
          {
            currencyCode: "EUR",
            currencyId: OPTIONS.currencies[1]!.id,
            id: "00000000-0000-4000-8000-000000000912",
            identity: "Euro account",
            isDefault: false,
            kind: "bank",
            kindLabel: "Банк",
            label: "EUR alt",
            ownerId: OPTIONS.organizations[0]!.id,
            ownerType: "organization",
          },
        ],
      },
      selectedLegId: null,
      state: selected,
    });

    expect(nodes[1]?.data.rows).toEqual([
      expect.objectContaining({
        active: true,
        label: "USD main",
        selected: true,
      }),
    ]);
    expect(edges[0]?.targetHandle).toContain(":requisite:");
    expect(edges[0]?.targetHandle).toContain("00000000-0000-4000-8000-000000000911");
  });
});
