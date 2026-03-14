import { describe, expect, it } from "vitest";

import {
  buildProjectedBalanceDeltas,
  projectBalanceSubjects,
} from "../src/domain/projection";

describe("balances projector helpers", () => {
  it("projects dimension ids into balance subjects", () => {
    expect(
      projectBalanceSubjects({
        organizationRequisiteId: "oa-1",
        customerId: "cust-1",
        ignored: "x",
        emptyId: "",
      }),
    ).toEqual([
      { subjectType: "organization_requisite", subjectId: "oa-1" },
      { subjectType: "customer", subjectId: "cust-1" },
    ]);
  });

  it("builds aggregated debit and credit deltas per subject", () => {
    expect(
      buildProjectedBalanceDeltas([
        {
          operationId: "op-1",
          sourceType: "payment",
          sourceId: "doc-1",
          operationCode: "PAYMENT.POST",
          lineNo: 1,
          bookId: "book-1",
          currency: "USD",
          amountMinor: 100n,
          postingCode: "PCODE",
          debitDimensions: {
            organizationRequisiteId: "oa-1",
            customerId: "cust-1",
          },
          creditDimensions: {
            organizationRequisiteId: "oa-2",
          },
        },
        {
          operationId: "op-1",
          sourceType: "payment",
          sourceId: "doc-1",
          operationCode: "PAYMENT.POST",
          lineNo: 2,
          bookId: "book-1",
          currency: "USD",
          amountMinor: 40n,
          postingCode: "PCODE",
          debitDimensions: {
            organizationRequisiteId: "oa-1",
          },
          creditDimensions: {
            customerId: "cust-1",
          },
        },
      ]),
    ).toEqual([
      {
        bookId: "book-1",
        currency: "USD",
        subjectType: "organization_requisite",
        subjectId: "oa-1",
        deltaLedgerBalance: 140n,
        deltaAvailable: 140n,
      },
      {
        bookId: "book-1",
        currency: "USD",
        subjectType: "customer",
        subjectId: "cust-1",
        deltaLedgerBalance: 60n,
        deltaAvailable: 60n,
      },
      {
        bookId: "book-1",
        currency: "USD",
        subjectType: "organization_requisite",
        subjectId: "oa-2",
        deltaLedgerBalance: -100n,
        deltaAvailable: -100n,
      },
    ]);
  });
});
