import { describe, expect, it } from "vitest";

import type { PaymentRouteConstructorOptions } from "@/features/payment-routes/lib/queries";
import {
  applyCalculation,
  createPaymentRouteSeed,
  insertIntermediateParticipant,
  moveIntermediateParticipant,
  removeIntermediateParticipant,
  setEditorMode,
  setLegField,
  setParticipantBinding,
  setParticipantOption,
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

  it("creates new routes with abstract source and destination endpoints", () => {
    const seed = createPaymentRouteSeed(OPTIONS)!;

    expect(seed.draft.participants[0]).toMatchObject({
      binding: "abstract",
      displayName: "Любой клиент",
      entityId: null,
      entityKind: null,
      role: "source",
    });
    expect(seed.draft.participants[1]).toMatchObject({
      binding: "abstract",
      displayName: "Любой бенефициар",
      entityId: null,
      entityKind: null,
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
      displayName: "Любой клиент",
      entityId: null,
      entityKind: null,
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

    expect(changedFirstInput.draft.currencyInId).toBe(OPTIONS.currencies[1]!.id);
    expect(changedFirstInput.draft.legs[0]!.fromCurrencyId).toBe(
      OPTIONS.currencies[1]!.id,
    );

    const changedLastOutput = setLegField(changedFirstInput, secondLeg.id, {
      toCurrencyId: USD.id,
    });

    expect(changedLastOutput.draft.currencyOutId).toBe(USD.id);
    expect(changedLastOutput.draft.legs[1]!.toCurrencyId).toBe(USD.id);
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
          kind: "transfer",
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
