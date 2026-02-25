import { describe, expect, it, vi } from "vitest";

import { createLedgerReadService } from "../src/read-service";

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
              bookOrgIds: null,
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
    expect(result.data[0]!.bookOrgIds).toEqual([]);
    expect(result.data[0]!.currencies).toEqual([]);
  });

  it("supports filtering by book org and returns zero total fallback", async () => {
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
      bookOrgId: "org-1",
      sortBy: "createdAt",
      sortOrder: "desc",
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

  it("returns operation details with account and org name mapping", async () => {
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
              bookOrgIds: ["org-1"],
              currencies: ["USD"],
            },
          ]),
        )
        .mockImplementationOnce(() =>
          makeWhereOrderByChain([
            {
              id: "posting-1",
              lineNo: 1,
              bookOrgId: "org-1",
              debitBookAccountId: "ba-1",
              creditBookAccountId: "ba-2",
              postingCode: "PCODE",
              currency: "USD",
              amountMinor: 100n,
              memo: "memo",
              analyticCounterpartyId: null,
              analyticCustomerId: null,
              analyticOrderId: null,
              analyticOperationalAccountId: null,
              analyticTransferId: null,
              analyticQuoteId: null,
              analyticFeeBucket: null,
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
            { id: "ba-1", accountNo: "1110" },
            { id: "ba-2", accountNo: "2110" },
          ]),
        )
        .mockImplementationOnce(() =>
          makeWhereChain([{ id: "org-1", shortName: "Org One" }]),
        ),
    } as any;

    const service = createLedgerReadService({ db });
    const details = await service.getOperationDetails("op-1");

    expect(details).not.toBeNull();
    expect(details!.operation.id).toBe("op-1");
    expect(details!.postings).toHaveLength(1);
    expect(details!.postings[0]!.bookOrgName).toBe("Org One");
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
              bookOrgIds: null,
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
        ),
    } as any;

    const service = createLedgerReadService({ db });
    const details = await service.getOperationDetails("op-2");

    expect(details).not.toBeNull();
    expect(details!.postings).toEqual([]);
    expect(details!.tbPlans).toHaveLength(1);
    expect(db.select).toHaveBeenCalledTimes(3);
  });
});
