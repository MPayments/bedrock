import { describe, expect, it } from "vitest";

import {
  ACCOUNT_NO,
  AccountingError,
  CorrespondenceRuleNotFoundError,
  ListFinancialResultsByCounterpartyQuerySchema,
  ListFinancialResultsByGroupQuerySchema,
  OPERATION_CODE,
  POSTING_CODE,
} from "../../accounting/src/index";
import {
  buildTransferApproveTemplate,
  buildTransferPendingActionTemplate,
  OPERATION_TRANSFER_TYPE,
  resolveAdjustmentInLedgerPostingTemplate,
  resolveAdjustmentReservePostingTemplate,
  resolveFeeReservePostingTemplate,
  resolveInLedgerFeePostingTemplate,
} from "../../accounting/src/templates";

describe("accounting template coverage", () => {
  it("builds intra-org pending transfer template", () => {
    const result = buildTransferApproveTemplate({
      transferId: "tr-1",
      kind: "intra_org",
      settlementMode: "pending",
      amountMinor: 100n,
      timeoutSeconds: 60,
      memo: "memo",
      source: {
        accountId: "src-acc",
        counterpartyId: "src-cp",
        bookOrgId: "org-1",
        bookAccountNo: ACCOUNT_NO.BANK,
        currencyCode: "USD",
      },
      destination: {
        accountId: "dst-acc",
        counterpartyId: "dst-cp",
        bookOrgId: "org-1",
        bookAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
        currencyCode: "USD",
      },
    });

    expect(result.operationCode).toBe(
      OPERATION_CODE.TRANSFER_APPROVE_PENDING_INTRA,
    );
    expect(result.destinationPendingRef).toBeNull();
    expect(result.transfers).toHaveLength(1);
    const transfer = result.transfers[0]!;
    expect(transfer.type).toBe(OPERATION_TRANSFER_TYPE.CREATE);
    expect(transfer.postingCode).toBe(POSTING_CODE.TRANSFER_INTRA_PENDING);
    expect(transfer.pending?.timeoutSeconds).toBe(60);
  });

  it("builds cross-org immediate transfer template", () => {
    const result = buildTransferApproveTemplate({
      transferId: "tr-2",
      kind: "cross_org",
      settlementMode: "immediate",
      amountMinor: 200n,
      timeoutSeconds: 30,
      source: {
        accountId: "src-acc",
        counterpartyId: "src-cp",
        bookOrgId: "org-src",
        bookAccountNo: ACCOUNT_NO.BANK,
        currencyCode: "USD",
      },
      destination: {
        accountId: "dst-acc",
        counterpartyId: "dst-cp",
        bookOrgId: "org-dst",
        bookAccountNo: ACCOUNT_NO.BANK,
        currencyCode: "USD",
      },
    });

    expect(result.operationCode).toBe(
      OPERATION_CODE.TRANSFER_APPROVE_IMMEDIATE_CROSS,
    );
    expect(result.destinationPendingRef).toBe("transfer:tr-2:destination");
    expect(result.transfers).toHaveLength(2);
    expect(result.transfers[0]!.postingCode).toBe(
      POSTING_CODE.TRANSFER_CROSS_SOURCE_IMMEDIATE,
    );
    expect(result.transfers[1]!.postingCode).toBe(
      POSTING_CODE.TRANSFER_CROSS_DEST_IMMEDIATE,
    );
  });

  it("builds settle/void pending templates", () => {
    const settle = buildTransferPendingActionTemplate({
      transferId: "tr-3",
      eventIdempotencyKey: "evt-1",
      eventType: "settle",
      currency: "USD",
      pendingIds: [11n, 12n],
    });

    expect(settle.operationCode).toBe(OPERATION_CODE.TRANSFER_SETTLE_PENDING);
    expect(settle.transfers).toHaveLength(2);
    expect(settle.transfers[0]!.type).toBe(
      OPERATION_TRANSFER_TYPE.POST_PENDING,
    );

    const voided = buildTransferPendingActionTemplate({
      transferId: "tr-4",
      eventIdempotencyKey: "evt-2",
      eventType: "void",
      currency: "USD",
      pendingIds: [13n],
    });

    expect(voided.operationCode).toBe(OPERATION_CODE.TRANSFER_VOID_PENDING);
    expect(voided.transfers[0]!.type).toBe(
      OPERATION_TRANSFER_TYPE.VOID_PENDING,
    );
  });

  it("resolves in-ledger fee posting templates for all kinds", () => {
    expect(resolveInLedgerFeePostingTemplate("fx_spread").postingCode).toBe(
      POSTING_CODE.SPREAD_REVENUE,
    );
    expect(resolveInLedgerFeePostingTemplate("bank_fee").postingCode).toBe(
      POSTING_CODE.BANK_FEE_REVENUE,
    );
    expect(
      resolveInLedgerFeePostingTemplate("blockchain_fee").postingCode,
    ).toBe(POSTING_CODE.BLOCKCHAIN_FEE_REVENUE);
    expect(resolveInLedgerFeePostingTemplate("manual_fee").postingCode).toBe(
      POSTING_CODE.ARBITRARY_FEE_REVENUE,
    );

    const fallback = resolveInLedgerFeePostingTemplate("other_fee");
    expect(fallback.postingCode).toBe(POSTING_CODE.FEE_REVENUE);
    expect(fallback.feeBucket).toBe("other_fee");
  });

  it("resolves reserve/adjustment templates", () => {
    const reserve = resolveFeeReservePostingTemplate("bank");
    expect(reserve.postingCode).toBe(POSTING_CODE.FEE_SEPARATE_PAYMENT_RESERVE);

    const increase = resolveAdjustmentInLedgerPostingTemplate(
      "increase_charge",
      "manual",
    );
    expect(increase.postingCode).toBe(POSTING_CODE.ADJUSTMENT_CHARGE);

    const decrease = resolveAdjustmentInLedgerPostingTemplate(
      "decrease_charge",
      "manual",
    );
    expect(decrease.postingCode).toBe(POSTING_CODE.ADJUSTMENT_REFUND);

    const reserveIncrease = resolveAdjustmentReservePostingTemplate(
      "increase_charge",
      "manual",
    );
    expect(reserveIncrease.debitAccountNo).toBe(ACCOUNT_NO.CUSTOMER_WALLET);

    const reserveDecrease = resolveAdjustmentReservePostingTemplate(
      "decrease_charge",
      "manual",
    );
    expect(reserveDecrease.debitAccountNo).toBe(ACCOUNT_NO.ADJUSTMENT_EXPENSE);
  });
});

describe("accounting validation coverage", () => {
  it("validates counterparty financial results query", () => {
    const ok = ListFinancialResultsByCounterpartyQuerySchema.safeParse({
      limit: 10,
      offset: 0,
      sortBy: "netMinor",
      sortOrder: "desc",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-02T00:00:00.000Z",
      currency: "usd",
      counterpartyId: "550e8400-e29b-41d4-a716-446655440000",
      groupId: "550e8400-e29b-41d4-a716-446655440001",
    });

    expect(ok.success).toBe(true);

    const bad = ListFinancialResultsByCounterpartyQuerySchema.safeParse({
      from: "bad-date",
      to: "bad-date",
      currency: "$",
      counterpartyId: "bad-id",
      groupId: "bad-id",
    });

    expect(bad.success).toBe(false);
  });

  it("validates group financial results query", () => {
    const ok = ListFinancialResultsByGroupQuerySchema.safeParse({
      groupId: [
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440001",
      ],
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-02T00:00:00.000Z",
      currency: "EUR",
    });

    expect(ok.success).toBe(true);

    const badMissingGroup = ListFinancialResultsByGroupQuerySchema.safeParse(
      {},
    );
    expect(badMissingGroup.success).toBe(false);

    const badValues = ListFinancialResultsByGroupQuerySchema.safeParse({
      groupId: ["bad-id"],
      from: "bad-date",
      to: "bad-date",
      currency: "*",
    });
    expect(badValues.success).toBe(false);
  });
});

describe("accounting errors", () => {
  it("constructs custom accounting errors", () => {
    const base = new AccountingError("base error");
    expect(base.name).toBe("AccountingError");
    expect(base.message).toBe("base error");

    const rule = new CorrespondenceRuleNotFoundError(
      "P",
      "1000",
      "2000",
      "org-1",
    );
    expect(rule.name).toBe("CorrespondenceRuleNotFoundError");
    expect(rule.message).toContain("postingCode=P");
  });
});
