import { describe, expect, it } from "vitest";

import {
  mapCounterpartyBalanceDto,
  mapFinancialResultRowDto,
  mapFinancialSummaryDto,
  mapOperationDetailsDto,
  mapPostingDto,
} from "../../src/routes/accounting/mappers";

describe("accounting mappers", () => {
  it("maps posting amountMinor to amount", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const mapped = mapPostingDto({
      id: "posting-1",
      lineNo: 1,
      bookId: "book-1",
      bookName: "Main",
      debitInstanceId: "debit-1",
      debitAccountNo: "1010",
      debitDimensions: null,
      creditInstanceId: "credit-1",
      creditAccountNo: "2010",
      creditDimensions: null,
      postingCode: "posting_code",
      currency: "USD",
      currencyPrecision: 2,
      amountMinor: 1234n,
      memo: null,
      context: null,
      createdAt,
    });

    expect(mapped).toMatchObject({
      amount: "12.34",
      createdAt: "2026-01-01T00:00:00.000Z",
      currency: "USD",
    });
    expect((mapped as Record<string, unknown>).amountMinor).toBeUndefined();
  });

  it("maps financial result rows and summaries", () => {
    const row = {
      entityType: "counterparty",
      counterpartyId: "11111111-1111-4111-8111-111111111111",
      counterpartyName: "Acme",
      currency: "USD",
      revenueMinor: 2500n,
      expenseMinor: 500n,
      netMinor: 2000n,
    };

    expect(mapFinancialResultRowDto(row)).toEqual({
      entityType: "counterparty",
      counterpartyId: "11111111-1111-4111-8111-111111111111",
      counterpartyName: "Acme",
      currency: "USD",
      revenue: "25",
      expense: "5",
      net: "20",
    });
    expect(mapFinancialSummaryDto(row)).toEqual({
      entityType: "counterparty",
      counterpartyId: "11111111-1111-4111-8111-111111111111",
      counterpartyName: "Acme",
      currency: "USD",
      revenue: "25",
      expense: "5",
      net: "20",
    });
  });

  it("maps counterparty balance amount", () => {
    expect(
      mapCounterpartyBalanceDto({
        counterpartyAccountId: "22222222-2222-4222-8222-222222222222",
        currency: "JPY",
        balanceMinor: 120n,
        precision: 0,
      }),
    ).toEqual({
      counterpartyAccountId: "22222222-2222-4222-8222-222222222222",
      currency: "JPY",
      balance: "120",
      precision: 0,
    });
  });

  it("maps operation details payload", () => {
    const details = mapOperationDetailsDto({
      operation: {
        id: "op-1",
        sourceType: "document",
        sourceId: "doc-1",
        operationCode: "op_code",
        operationVersion: 1,
        postingDate: new Date("2026-01-01T00:00:00.000Z"),
        status: "posted",
        error: null,
        postedAt: new Date("2026-01-01T00:05:00.000Z"),
        outboxAttempts: 0,
        lastOutboxErrorAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        postingCount: 1,
        bookIds: ["book-1"],
        bookLabels: {},
        currencies: ["USD"],
      },
      postings: [
        {
          id: "posting-1",
          lineNo: 1,
          bookId: "book-1",
          bookName: "Main book",
          debitInstanceId: "debit-1",
          debitAccountNo: "1010",
          debitDimensions: null,
          creditInstanceId: "credit-1",
          creditAccountNo: "2010",
          creditDimensions: null,
          postingCode: "posting_code",
          currency: "USD",
          currencyPrecision: 2,
          amountMinor: 500n,
          memo: null,
          context: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      tbPlans: [
        {
          id: "plan-1",
          lineNo: 1,
          type: "create",
          transferId: 11n,
          debitTbAccountId: 21n,
          creditTbAccountId: 31n,
          tbLedger: 1,
          amount: 500n,
          code: 1,
          pendingRef: null,
          pendingId: 41n,
          isLinked: false,
          isPending: false,
          timeoutSeconds: 0,
          status: "posted",
          error: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      dimensionLabels: { "book-1": "Main book" },
    });

    expect(details.operation).toMatchObject({
      postingDate: "2026-01-01T00:00:00.000Z",
      postedAt: "2026-01-01T00:05:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      bookLabels: { "book-1": "Main book" },
    });
    expect(details.postings[0]).toMatchObject({
      amount: "5",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(details.tbPlans[0]).toMatchObject({
      transferId: "11",
      debitTbAccountId: "21",
      creditTbAccountId: "31",
      amount: "500",
      pendingId: "41",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
