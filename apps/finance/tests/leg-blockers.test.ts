import { describe, expect, it } from "vitest";

import { collectLegBlockers } from "@/features/treasury/deals/lib/leg-blockers";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

type Leg = FinanceDealWorkbench["executionPlan"][number];

function makeLeg(overrides: Partial<Leg>): Leg {
  return {
    actions: {
      canCreateLegOperation: false,
      exchangeDocument: null,
    },
    fromCurrencyId: null,
    id: "leg-id",
    idx: 1,
    kind: "collect",
    operationRefs: [],
    routeSnapshotLegId: null,
    state: "pending",
    toCurrencyId: null,
    ...overrides,
  };
}

function makeDeal(
  overrides: Partial<FinanceDealWorkbench>,
): FinanceDealWorkbench {
  return {
    attachmentRequirements: [],
    formalDocumentRequirements: [],
    operationalState: { positions: [] },
    ...overrides,
  } as unknown as FinanceDealWorkbench;
}

describe("collectLegBlockers", () => {
  it("returns an empty list when nothing blocks this leg", () => {
    const leg = makeLeg({ kind: "collect", state: "pending" });
    const deal = makeDeal({});
    expect(collectLegBlockers(deal, leg)).toEqual([]);
  });

  it("surfaces a blocked leg's own state", () => {
    const leg = makeLeg({ kind: "collect", state: "blocked" });
    const deal = makeDeal({});
    const blockers = collectLegBlockers(deal, leg);
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers[0]).toMatch(/collect|сбор|исполн/iu);
  });

  it("surfaces an operational-position blocker scoped to the leg kind", () => {
    const leg = makeLeg({ kind: "collect" });
    const deal = makeDeal({
      operationalState: {
        positions: [
          {
            amountMinor: null,
            kind: "customer_receivable",
            reasonCode: "awaiting_customer_payment",
            state: "blocked",
          },
        ],
      },
    });
    const blockers = collectLegBlockers(deal, leg);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatch(/заблокир/iu);
  });

  it("ignores operational positions that don't map to this leg kind", () => {
    const leg = makeLeg({ kind: "collect" });
    const deal = makeDeal({
      operationalState: {
        positions: [
          {
            amountMinor: null,
            kind: "provider_payable", // maps to payout/settle_exporter, not collect
            reasonCode: null,
            state: "blocked",
          },
        ],
      },
    });
    expect(collectLegBlockers(deal, leg)).toEqual([]);
  });

  it("surfaces missing opening document (invoice) on the collect leg", () => {
    const leg = makeLeg({ kind: "collect" });
    const deal = makeDeal({
      formalDocumentRequirements: [
        {
          activeDocumentId: null,
          blockingReasons: ["Opening document is required: invoice"],
          createAllowed: false,
          docType: "invoice",
          openAllowed: false,
          stage: "opening",
          state: "missing",
        },
      ],
    });
    const blockers = collectLegBlockers(deal, leg);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatch(/invoice|инвойс/iu);
  });

  it("does not surface collect-leg document blockers on unrelated legs", () => {
    const deal = makeDeal({
      formalDocumentRequirements: [
        {
          activeDocumentId: null,
          blockingReasons: ["Opening document is required: invoice"],
          createAllowed: false,
          docType: "invoice",
          openAllowed: false,
          stage: "opening",
          state: "missing",
        },
      ],
    });
    expect(
      collectLegBlockers(deal, makeLeg({ kind: "payout" })),
    ).toEqual([]);
    expect(
      collectLegBlockers(deal, makeLeg({ kind: "convert" })),
    ).toEqual([]);
  });

  it("maps transfer_intra / transfer_intercompany to transit_hold legs", () => {
    const deal = makeDeal({
      formalDocumentRequirements: [
        {
          activeDocumentId: null,
          blockingReasons: ["Transit document required"],
          createAllowed: false,
          docType: "transfer_intra",
          openAllowed: false,
          stage: "opening",
          state: "in_progress",
        },
      ],
    });
    const blockers = collectLegBlockers(
      deal,
      makeLeg({ kind: "transit_hold" }),
    );
    expect(blockers).toContain("Transit document required");
  });

  it("surfaces missing invoice attachment only on the collect leg", () => {
    const deal = makeDeal({
      attachmentRequirements: [
        {
          blockingReasons: ["Инвойс по сделке не загружен"],
          code: "invoice",
          label: "Инвойс",
          state: "missing",
        },
      ],
    });
    expect(
      collectLegBlockers(deal, makeLeg({ kind: "collect" })),
    ).toContain("Инвойс по сделке не загружен");
    expect(
      collectLegBlockers(deal, makeLeg({ kind: "payout" })),
    ).toEqual([]);
  });

  it("dedupes identical messages and honors the cap", () => {
    const leg = makeLeg({ kind: "collect", state: "blocked" });
    const duplicatedReason = "Opening document is required: invoice";
    const deal = makeDeal({
      formalDocumentRequirements: [
        {
          activeDocumentId: null,
          blockingReasons: [duplicatedReason, duplicatedReason],
          createAllowed: false,
          docType: "invoice",
          openAllowed: false,
          stage: "opening",
          state: "missing",
        },
      ],
      attachmentRequirements: [
        {
          blockingReasons: [duplicatedReason],
          code: "invoice",
          label: "Инвойс",
          state: "missing",
        },
      ],
      operationalState: {
        positions: [
          {
            amountMinor: null,
            kind: "customer_receivable",
            reasonCode: null,
            state: "blocked",
          },
        ],
      },
    });
    const blockers = collectLegBlockers(deal, leg, 2);
    expect(blockers).toHaveLength(2);
    // No duplicates
    expect(new Set(blockers).size).toBe(blockers.length);
  });
});
