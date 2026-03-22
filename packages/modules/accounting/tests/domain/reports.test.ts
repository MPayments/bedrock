import { describe, expect, it } from "vitest";

import {
  computeAccountNetMovements,
  resolveRevenueExpenseEffect,
} from "../../src/reports/domain";

describe("accounting reports domain", () => {
  it("computes net movements by account and currency from scoped postings", () => {
    const movements = computeAccountNetMovements([
      {
        operationId: "op-1",
        lineNo: 1,
        postingDate: new Date("2026-03-01T00:00:00.000Z"),
        status: "posted",
        bookId: "book-1",
        bookLabel: "Main",
        bookCounterpartyId: null,
        currency: "USD",
        amountMinor: 100n,
        postingCode: "TR.1000",
        debitAccountNo: "1010",
        creditAccountNo: "2010",
        analyticCounterpartyId: null,
        documentId: null,
        documentType: null,
        channel: null,
      },
      {
        operationId: "op-2",
        lineNo: 1,
        postingDate: new Date("2026-03-02T00:00:00.000Z"),
        status: "posted",
        bookId: "book-1",
        bookLabel: "Main",
        bookCounterpartyId: null,
        currency: "USD",
        amountMinor: 40n,
        postingCode: "TR.1001",
        debitAccountNo: "2010",
        creditAccountNo: "1010",
        analyticCounterpartyId: null,
        documentId: null,
        documentType: null,
        channel: null,
      },
    ]);

    expect(movements).toEqual(
      expect.arrayContaining([
        {
          accountNo: "1010",
          currency: "USD",
          netMinor: 60n,
        },
        {
          accountNo: "2010",
          currency: "USD",
          netMinor: -60n,
        },
      ]),
    );
  });

  it("resolves revenue and expense effects from posting side semantics", () => {
    expect(
      resolveRevenueExpenseEffect({
        kind: "revenue",
        side: "debit",
        amountMinor: 25n,
      }),
    ).toEqual({
      kind: "revenue",
      amountMinor: -25n,
    });
    expect(
      resolveRevenueExpenseEffect({
        kind: "expense",
        side: "credit",
        amountMinor: 25n,
      }),
    ).toEqual({
      kind: "expense",
      amountMinor: -25n,
    });
    expect(
      resolveRevenueExpenseEffect({
        kind: "asset",
        side: "debit",
        amountMinor: 25n,
      }),
    ).toBeNull();
  });
});
