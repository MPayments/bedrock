import { describe, expect, it } from "vitest";

import {
  ABSTRACT_PAYMENT_ROUTE_DESTINATION_DISPLAY_NAME,
  ABSTRACT_PAYMENT_ROUTE_SOURCE_DISPLAY_NAME,
} from "@bedrock/calculations/contracts";
import type { PaymentRouteConstructorOptions } from "@/features/payment-routes/lib/queries";
import { syncPaymentRouteDraftRequisites } from "@/features/payment-routes/lib/requisites";
import {
  addAdditionalFee,
  applyCalculation,
  createPaymentRouteSeed,
  insertIntermediateParticipant,
  isDefaultPaymentRouteViewport,
  moveIntermediateParticipant,
  removeIntermediateParticipant,
  setEditorMode,
  setLegField,
  setParticipantBinding,
  setParticipantOption,
  setParticipantRequisiteId,
  setVisualNodePosition,
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

const COUNTERPARTY = OPTIONS.counterparties[0]!;
const USD = OPTIONS.currencies[0]!;

describe("payment route editor state", () => {
  it("keeps business draft stable when only graph metadata changes", () => {
    const seed = createPaymentRouteSeed(OPTIONS);

    expect(seed).not.toBeNull();

    const state = seed!;
    const draftBefore = structuredClone(state.draft);
    const sourceNodeId = state.draft.participants[0]!.nodeId;
    const next = setVisualNodePosition({
      nodeId: sourceNodeId,
      position: { x: 640, y: 220 },
      state,
    });

    expect(next.draft).toEqual(draftBefore);
    expect(next.visual.nodePositions[sourceNodeId]).toEqual({ x: 640, y: 220 });
  });

  it("detects when a stored graph viewport should be restored", () => {
    expect(
      isDefaultPaymentRouteViewport({
        x: 0,
        y: 0,
        zoom: 1,
      }),
    ).toBe(true);
    expect(
      isDefaultPaymentRouteViewport({
        x: 120,
        y: -48,
        zoom: 0.82,
      }),
    ).toBe(false);
  });

  it("creates new routes with abstract source and destination endpoints", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;

    expect(seed.draft.participants[0]).toMatchObject({
      binding: "abstract",
      displayName: ABSTRACT_PAYMENT_ROUTE_SOURCE_DISPLAY_NAME,
      entityId: null,
      entityKind: null,
      requisiteId: null,
      role: "source",
    });
    expect(seed.draft.participants[1]).toMatchObject({
      binding: "abstract",
      displayName: ABSTRACT_PAYMENT_ROUTE_DESTINATION_DISPLAY_NAME,
      entityId: null,
      entityKind: null,
      requisiteId: null,
      role: "destination",
    });
  });

  it("reorders intermediate hops while keeping participants and legs aligned", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;
    const withFirstHop = insertIntermediateParticipant({
      afterLegIndex: 0,
      options: OPTIONS,
      state: seed,
    });
    const withSecondHop = insertIntermediateParticipant({
      afterLegIndex: 1,
      options: OPTIONS,
      state: withFirstHop,
    });
    const withDistinctMiddle = setParticipantOption({
      entityId: COUNTERPARTY.id,
      entityKind: "counterparty",
      index: 1,
      options: OPTIONS,
      state: withSecondHop,
    });
    const firstLegId = withDistinctMiddle.draft.legs[0]!.id;
    const secondLegId = withDistinctMiddle.draft.legs[1]!.id;
    const reordered = moveIntermediateParticipant({
      direction: "down",
      participantIndex: 1,
      state: withDistinctMiddle,
    });

    expect(reordered.draft.participants).toHaveLength(4);
    expect(reordered.draft.legs).toHaveLength(3);
    expect(reordered.draft.participants[2]).toMatchObject({
      binding: "bound",
      entityId: COUNTERPARTY.id,
      entityKind: "counterparty",
      role: "hop",
    });
    expect(reordered.draft.legs[0]!.id).toBe(secondLegId);
    expect(reordered.draft.legs[1]!.id).toBe(firstLegId);
    expect(reordered.draft.legs[0]!.fromCurrencyId).toBe(
      reordered.draft.currencyInId,
    );
    expect(reordered.draft.legs[1]!.fromCurrencyId).toBe(
      reordered.draft.legs[0]!.toCurrencyId,
    );

    const removed = removeIntermediateParticipant(reordered, 2);

    expect(removed.draft.participants).toHaveLength(3);
    expect(removed.draft.legs).toHaveLength(2);
    expect(removed.selection).toMatchObject({
      kind: "leg",
    });
  });

  it("toggles source endpoint between abstract and bound customer", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;
    const bound = setParticipantBinding({
      binding: "bound",
      index: 0,
      options: OPTIONS,
      state: seed,
    });

    expect(bound.draft.participants[0]).toMatchObject({
      binding: "bound",
      entityId: OPTIONS.customers[0]!.id,
      entityKind: "customer",
      requisiteId: null,
      role: "source",
    });

    const abstract = setParticipantBinding({
      binding: "abstract",
      index: 0,
      options: OPTIONS,
      state: bound,
    });

    expect(abstract.draft.participants[0]).toMatchObject({
      binding: "abstract",
      displayName: ABSTRACT_PAYMENT_ROUTE_SOURCE_DISPLAY_NAME,
      entityId: null,
      entityKind: null,
      requisiteId: null,
      role: "source",
    });
  });

  it("keeps route currencies continuous when a leg currency changes", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;
    const withSecondLeg = insertIntermediateParticipant({
      afterLegIndex: 0,
      options: OPTIONS,
      state: seed,
    });

    const firstLeg = withSecondLeg.draft.legs[0]!;
    const secondLeg = withSecondLeg.draft.legs[1]!;
    const changedFirstOutput = setLegField(withSecondLeg, firstLeg.id, {
      toCurrencyId: OPTIONS.currencies[1]!.id,
    });

    expect(changedFirstOutput.draft.legs[0]!.toCurrencyId).toBe(
      OPTIONS.currencies[1]!.id,
    );
    expect(changedFirstOutput.draft.legs[1]!.fromCurrencyId).toBe(
      OPTIONS.currencies[1]!.id,
    );

    const changedFirstInput = setLegField(changedFirstOutput, firstLeg.id, {
      fromCurrencyId: OPTIONS.currencies[1]!.id,
    });

    expect(changedFirstInput.draft.currencyInId).toBe(
      OPTIONS.currencies[1]!.id,
    );
    expect(changedFirstInput.draft.legs[0]!.fromCurrencyId).toBe(
      OPTIONS.currencies[1]!.id,
    );

    const changedLastOutput = setLegField(changedFirstInput, secondLeg.id, {
      toCurrencyId: USD.id,
    });

    expect(changedLastOutput.draft.currencyOutId).toBe(USD.id);
    expect(changedLastOutput.draft.legs[1]!.toCurrencyId).toBe(USD.id);
  });

  it("clears a selected requisite when the participant operational currency changes", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;
    const boundDestination = setParticipantBinding({
      binding: "bound",
      index: 1,
      options: OPTIONS,
      state: seed,
    });
    const withRequisite = setParticipantRequisiteId({
      index: 1,
      requisiteId: "00000000-0000-4000-8000-000000000901",
      state: boundDestination,
    });
    const changedCurrency = setLegField(
      withRequisite,
      withRequisite.draft.legs[0]!.id,
      {
        toCurrencyId: OPTIONS.currencies[1]!.id,
      },
    );

    expect(changedCurrency.draft.participants[1]?.requisiteId).toBeNull();
  });

  it("defaults a new additional fee to the route input currency", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;
    const next = addAdditionalFee(seed);

    expect(next.draft.additionalFees[0]).toMatchObject({
      currencyId: seed.draft.currencyInId,
      label: "Доп. расход",
    });
  });

  it("auto-selects the default matching requisite and leaves ambiguous sets unresolved", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;
    const boundDestination = setParticipantBinding({
      binding: "bound",
      index: 1,
      options: OPTIONS,
      state: seed,
    });

    const autoSelected = syncPaymentRouteDraftRequisites({
      draft: boundDestination.draft,
      options: OPTIONS,
      requisitesByOwner: {
        [`organization:${OPTIONS.organizations[0]!.id}`]: [
          {
            currencyCode: "USD",
            currencyId: USD.id,
            id: "00000000-0000-4000-8000-000000000911",
            identity: "Default account",
            isDefault: true,
            kind: "bank",
            kindLabel: "Банк",
            label: "USD default",
            ownerId: OPTIONS.organizations[0]!.id,
            ownerType: "organization",
          },
          {
            currencyCode: "USD",
            currencyId: USD.id,
            id: "00000000-0000-4000-8000-000000000912",
            identity: "Backup account",
            isDefault: false,
            kind: "bank",
            kindLabel: "Банк",
            label: "USD backup",
            ownerId: OPTIONS.organizations[0]!.id,
            ownerType: "organization",
          },
        ],
      },
      statusByOwner: {
        [`organization:${OPTIONS.organizations[0]!.id}`]: {
          error: null,
          pending: false,
        },
      },
    });

    expect(autoSelected.participants[1]?.requisiteId).toBe(
      "00000000-0000-4000-8000-000000000911",
    );

    const ambiguous = syncPaymentRouteDraftRequisites({
      draft: boundDestination.draft,
      options: OPTIONS,
      requisitesByOwner: {
        [`organization:${OPTIONS.organizations[0]!.id}`]: [
          {
            currencyCode: "USD",
            currencyId: USD.id,
            id: "00000000-0000-4000-8000-000000000921",
            identity: "Primary",
            isDefault: false,
            kind: "bank",
            kindLabel: "Банк",
            label: "USD A",
            ownerId: OPTIONS.organizations[0]!.id,
            ownerType: "organization",
          },
          {
            currencyCode: "USD",
            currencyId: USD.id,
            id: "00000000-0000-4000-8000-000000000922",
            identity: "Secondary",
            isDefault: false,
            kind: "bank",
            kindLabel: "Банк",
            label: "USD B",
            ownerId: OPTIONS.organizations[0]!.id,
            ownerType: "organization",
          },
        ],
      },
      statusByOwner: {
        [`organization:${OPTIONS.organizations[0]!.id}`]: {
          error: null,
          pending: false,
        },
      },
    });

    expect(ambiguous.participants[1]?.requisiteId).toBeNull();
  });

  it("applies calculator results and preserves state across manual and graph modes", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;
    const graphMode = setEditorMode(seed, "graph");
    const manualMode = setEditorMode(graphMode, "manual");
    const next = applyCalculation(manualMode, {
      additionalFees: [],
      amountInMinor: "1200000",
      amountOutMinor: "1188000",
      computedAt: "2026-04-16T08:00:00.000Z",
      currencyInId: USD.id,
      currencyOutId: USD.id,
      feeTotals: [
        {
          amountMinor: "12000",
          currencyId: USD.id,
        },
      ],
      grossAmountOutMinor: "1200000",
      legs: [
        {
          asOf: "2026-04-16T08:00:00.000Z",
          fees: [
            {
              amountMinor: "12000",
              currencyId: USD.id,
              id: "fee-1",
              inputImpactCurrencyId: USD.id,
              inputImpactMinor: "12000",
              kind: "fixed",
              label: "Bank fee",
              outputImpactCurrencyId: USD.id,
              outputImpactMinor: "12000",
            },
          ],
          fromCurrencyId: USD.id,
          grossOutputMinor: "1200000",
          id: manualMode.draft.legs[0]!.id,
          idx: 1,
          inputAmountMinor: "1200000",
          netOutputMinor: "1188000",
          rateDen: "1",
          rateNum: "1",
          rateSource: "identity",
          toCurrencyId: USD.id,
        },
      ],
      lockedSide: "currency_in",
      netAmountOutMinor: "1188000",
    });

    expect(next.mode).toBe("manual");
    expect(next.draft.amountInMinor).toBe("1200000");
    expect(next.draft.amountOutMinor).toBe("1188000");
    expect(next.calculation?.netAmountOutMinor).toBe("1188000");
  });
});
