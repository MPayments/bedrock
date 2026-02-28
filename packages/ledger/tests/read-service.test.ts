import { describe, expect, it, vi } from "vitest";

import { createLedgerReadService } from "../src/read-service";
import { resolveDimensionLabelsFromInstances } from "../src/queries/read";

function makeListRowsChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(async () => rows),
              })),
            })),
          })),
        })),
      })),
    })),
  };
}

function makeWhereChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(async () => rows),
    })),
  };
}

function makeDetailsOperationChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => ({
            limit: vi.fn(async () => rows),
          })),
        })),
      })),
    })),
  };
}

function makeWhereOrderByChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(async () => rows),
      })),
    })),
  };
}

function makeExecuteRows(rows: unknown[]) {
  return vi.fn(async () => ({ rows }));
}

describe("createLedgerReadService", () => {
  it("lists operations with pagination and summary fields", async () => {
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() =>
          makeListRowsChain([
            {
              id: "op-1",
              sourceType: "payment",
              sourceId: "pay-1",
              operationCode: "OP.CODE",
              operationVersion: 1,
              postingDate: new Date("2026-01-01T00:00:00Z"),
              status: "pending",
              error: null,
              postedAt: null,
              outboxAttempts: 0,
              lastOutboxErrorAt: null,
              createdAt: new Date("2026-01-01T00:00:00Z"),
              postingCount: 2,
              bookIds: null,
              currencies: null,
            },
          ]),
        )
        .mockImplementationOnce(() => makeWhereChain([{ total: 1 }])),
    } as any;

    const service = createLedgerReadService({ db });
    const result = await service.listOperations({
      limit: 10,
      offset: 0,
      status: ["pending"],
      sourceType: ["payment"],
      sourceId: "pay-1",
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(result.total).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe("op-1");
    expect(result.data[0]!.bookIds).toEqual([]);
    expect(result.data[0]!.currencies).toEqual([]);
  });

  it("supports free-text query search alongside exact filters", async () => {
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => makeListRowsChain([]))
        .mockImplementationOnce(() => makeWhereChain([{ total: 0 }])),
    } as any;

    const service = createLedgerReadService({ db });
    const result = await service.listOperations({
      limit: 10,
      offset: 0,
      query: "transfer",
      status: ["pending"],
      sourceId: "pay-1",
    });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("supports filtering by book and returns zero total fallback", async () => {
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => makeListRowsChain([]))
        .mockImplementationOnce(() => makeWhereChain([])),
    } as any;

    const service = createLedgerReadService({ db });
    const result = await service.listOperations({
      limit: 5,
      offset: 0,
      bookId: "org-1",
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("supports filtering operations by counterparty", async () => {
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => makeListRowsChain([]))
        .mockImplementationOnce(() => makeWhereChain([{ total: 0 }])),
    } as any;

    const service = createLedgerReadService({ db });
    const result = await service.listOperations({
      limit: 10,
      offset: 0,
      counterpartyId: "550e8400-e29b-41d4-a716-446655440301",
    });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns null when operation details are missing", async () => {
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => makeDetailsOperationChain([])),
    } as any;

    const service = createLedgerReadService({ db });
    const details = await service.getOperationDetails("op-missing");

    expect(details).toBeNull();
  });

  it("returns operation details with account and book name mapping", async () => {
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() =>
          makeDetailsOperationChain([
            {
              id: "op-1",
              sourceType: "payment",
              sourceId: "pay-1",
              operationCode: "OP.CODE",
              operationVersion: 1,
              postingDate: new Date("2026-01-01T00:00:00Z"),
              status: "posted",
              error: null,
              postedAt: new Date("2026-01-01T00:01:00Z"),
              outboxAttempts: 1,
              lastOutboxErrorAt: null,
              createdAt: new Date("2026-01-01T00:00:00Z"),
              postingCount: 1,
              bookIds: ["org-1"],
              currencies: ["USD"],
            },
          ]),
        )
        .mockImplementationOnce(() =>
          makeWhereOrderByChain([
            {
              id: "posting-1",
              lineNo: 1,
              bookId: "org-1",
              debitInstanceId: "ba-1",
              creditInstanceId: "ba-2",
              postingCode: "PCODE",
              currency: "USD",
              amountMinor: 100n,
              memo: "memo",
              context: null,
              createdAt: new Date("2026-01-01T00:00:00Z"),
            },
          ]),
        )
        .mockImplementationOnce(() =>
          makeWhereOrderByChain([
            {
              id: "plan-1",
              lineNo: 1,
              type: "create",
              transferId: 10n,
              debitTbAccountId: 11n,
              creditTbAccountId: 12n,
              tbLedger: 100,
              amount: 100n,
              code: 1,
              pendingRef: null,
              pendingId: null,
              isLinked: false,
              isPending: false,
              timeoutSeconds: 0,
              status: "posted",
              error: null,
              createdAt: new Date("2026-01-01T00:00:00Z"),
            },
          ]),
        )
        .mockImplementationOnce(() =>
          makeWhereChain([
            { id: "ba-1", accountNo: "1110", dimensions: {} },
            { id: "ba-2", accountNo: "2110", dimensions: {} },
          ]),
        )
        .mockImplementationOnce(() =>
          makeWhereChain([{ id: "org-1", name: "Org One" }]),
        )
        .mockImplementationOnce(() =>
          makeWhereChain([{ code: "USD", precision: 2 }]),
        ),
    } as any;

    const service = createLedgerReadService({ db });
    const details = await service.getOperationDetails("op-1");

    expect(details).not.toBeNull();
    expect(details!.operation.id).toBe("op-1");
    expect(details!.postings).toHaveLength(1);
    expect(details!.operation.bookIds).toEqual(["org-1"]);
    expect(details!.postings[0]!.bookName).toBe("Org One");
    expect(details!.postings[0]!.debitAccountNo).toBe("1110");
    expect(details!.postings[0]!.creditAccountNo).toBe("2110");
    expect(details!.tbPlans).toHaveLength(1);
    expect(details!.tbPlans[0]!.transferId).toBe(10n);
  });

  it("returns details for operation without postings", async () => {
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() =>
          makeDetailsOperationChain([
            {
              id: "op-2",
              sourceType: "event",
              sourceId: "evt-1",
              operationCode: "OP.EMPTY",
              operationVersion: 1,
              postingDate: new Date("2026-01-01T00:00:00Z"),
              status: "pending",
              error: null,
              postedAt: null,
              outboxAttempts: 0,
              lastOutboxErrorAt: null,
              createdAt: new Date("2026-01-01T00:00:00Z"),
              postingCount: 0,
              bookIds: null,
              currencies: null,
            },
          ]),
        )
        .mockImplementationOnce(() => makeWhereOrderByChain([]))
        .mockImplementationOnce(() =>
          makeWhereOrderByChain([
            {
              id: "plan-void",
              lineNo: 1,
              type: "void_pending",
              transferId: 20n,
              debitTbAccountId: null,
              creditTbAccountId: null,
              tbLedger: 0,
              amount: 0n,
              code: 0,
              pendingRef: null,
              pendingId: 99n,
              isLinked: false,
              isPending: false,
              timeoutSeconds: 0,
              status: "pending",
              error: null,
              createdAt: new Date("2026-01-01T00:00:00Z"),
            },
          ]),
        )
        .mockImplementationOnce(() => makeWhereChain([]))
        .mockImplementationOnce(() => makeWhereChain([]))
        .mockImplementationOnce(() => makeWhereChain([])),
    } as any;

    const service = createLedgerReadService({ db });
    const details = await service.getOperationDetails("op-2");

    expect(details).not.toBeNull();
    expect(details!.postings).toEqual([]);
    expect(details!.tbPlans).toHaveLength(1);
    expect(db.select).toHaveBeenCalledTimes(3);
  });

  it("resolves dimension labels in operation details", async () => {
    const counterpartyId = "550e8400-e29b-41d4-a716-446655440301";
    const operationalAccountId = "550e8400-e29b-41d4-a716-446655440302";
    const customerId = "550e8400-e29b-41d4-a716-446655440303";
    const paymentOrderId = "550e8400-e29b-41d4-a716-446655440304";
    const transferOrderId = "550e8400-e29b-41d4-a716-446655440305";

    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() =>
          makeDetailsOperationChain([
            {
              id: "op-3",
              sourceType: "transfer",
              sourceId: "tr-1",
              operationCode: "TR.CODE",
              operationVersion: 1,
              postingDate: new Date("2026-01-01T00:00:00Z"),
              status: "posted",
              error: null,
              postedAt: null,
              outboxAttempts: 0,
              lastOutboxErrorAt: null,
              createdAt: new Date("2026-01-01T00:00:00Z"),
              postingCount: 1,
              bookIds: ["org-1"],
              currencies: ["USD"],
            },
          ]),
        )
        .mockImplementationOnce(() =>
          makeWhereOrderByChain([
            {
              id: "posting-3",
              lineNo: 1,
              bookId: "org-1",
              debitInstanceId: "inst-1",
              creditInstanceId: "inst-2",
              postingCode: "TR.INTRA.IMMEDIATE",
              currency: "USD",
              amountMinor: 50n,
              memo: null,
              context: null,
              createdAt: new Date("2026-01-01T00:00:00Z"),
            },
          ]),
        )
        .mockImplementationOnce(() => makeWhereOrderByChain([]))
        .mockImplementationOnce(() =>
          makeWhereChain([
            {
              id: "inst-1",
              accountNo: "1110",
              dimensions: {
                counterpartyId,
                operationalAccountId,
                customerId,
                orderId: paymentOrderId,
              },
            },
            {
              id: "inst-2",
              accountNo: "2110",
              dimensions: { orderId: transferOrderId },
            },
          ]),
        )
        .mockImplementationOnce(() =>
          makeWhereChain([{ id: "org-1", shortName: "Org One" }]),
        )
        .mockImplementationOnce(() =>
          makeWhereChain([{ code: "USD", precision: 2 }]),
        )
        .mockImplementationOnce(() =>
          makeWhereChain([{ id: counterpartyId, label: "Counterparty" }]),
        )
        .mockImplementationOnce(() =>
          makeWhereChain([{ id: operationalAccountId, label: "Settlement OA" }]),
        )
        .mockImplementationOnce(() =>
          makeWhereChain([{ id: customerId, label: "Customer A" }]),
        )
        .mockImplementationOnce(() =>
          makeWhereChain([
            {
              id: paymentOrderId,
              docNo: "PAY-550E8400",
              docType: "payment_case",
              title: "Payment case",
            },
            {
              id: transferOrderId,
              docNo: "TRN-550E8400",
              docType: "transfer",
              title: "Transfer USD",
            },
          ]),
        ),
    } as any;

    const service = createLedgerReadService({ db });
    const details = await service.getOperationDetails("op-3");

    expect(details).not.toBeNull();
    expect(details!.dimensionLabels[counterpartyId]).toBe("Counterparty");
    expect(details!.dimensionLabels[operationalAccountId]).toBe("Settlement OA");
    expect(details!.dimensionLabels[customerId]).toBe("Customer A");
    expect(details!.dimensionLabels[paymentOrderId]).toBe(
      "payment_case PAY-550E8400 · Payment case",
    );
    expect(details!.dimensionLabels[transferOrderId]).toBe(
      "transfer TRN-550E8400 · Transfer USD",
    );
  });

  it("returns empty balance list when no account ids are provided", async () => {
    const db = {
      execute: vi.fn(),
      select: vi.fn(),
    } as any;

    const service = createLedgerReadService({ db });
    const balances = await service.getBalancesByOperationalAccountIds([]);

    expect(balances).toEqual([]);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("returns balances and currency precision by operational account", async () => {
    const db = {
      execute: makeExecuteRows([
        {
          operational_account_id: "550e8400-e29b-41d4-a716-446655440401",
          currency: "USD",
          balance_minor: "150",
        },
        {
          operational_account_id: "550e8400-e29b-41d4-a716-446655440402",
          currency: "EUR",
          balance_minor: "-20",
        },
      ]),
      select: vi.fn().mockImplementationOnce(() =>
        makeWhereChain([
          { code: "USD", precision: 2 },
          { code: "EUR", precision: 2 },
        ]),
      ),
    } as any;

    const service = createLedgerReadService({ db });
    const balances = await service.getBalancesByOperationalAccountIds([
      "550e8400-e29b-41d4-a716-446655440401",
      "550e8400-e29b-41d4-a716-446655440402",
    ]);

    expect(balances).toEqual([
      {
        operationalAccountId: "550e8400-e29b-41d4-a716-446655440401",
        currency: "USD",
        balanceMinor: 150n,
        precision: 2,
      },
      {
        operationalAccountId: "550e8400-e29b-41d4-a716-446655440402",
        currency: "EUR",
        balanceMinor: -20n,
        precision: 2,
      },
    ]);
  });

  it("chunks dimension resolver calls when inArray chunk size is small", async () => {
    const resolver = vi.fn(async ({ values }: { values: string[] }) => {
      return new Map(values.map((value) => [value, `label:${value}`]));
    });

    const labels = await resolveDimensionLabelsFromInstances({
      db: {} as any,
      instances: [
        { dimensions: { counterpartyId: "cp-1" } },
        { dimensions: { counterpartyId: "cp-2" } },
      ],
      registry: { counterpartyId: resolver },
      inArrayChunkSize: 1,
    });

    expect(resolver).toHaveBeenCalledTimes(2);
    expect(labels).toEqual({
      "cp-1": "label:cp-1",
      "cp-2": "label:cp-2",
    });
  });
});
