import { beforeEach, describe, expect, it, vi } from "vitest";

import { schema } from "@bedrock/core/ledger/schema";

import {
  createSmartStubDb,
  createTestEntry,
  createTestTransferPlan,
  type StubDatabase,
} from "./helpers";
import { createLedgerEngine } from "../../src/ledger/engine";
import { IdempotencyConflictError } from "../../src/ledger/errors";
import { OPERATION_TRANSFER_TYPE } from "../../src/ledger/types";

function createCreateTransferTx(options?: {
  ruleExists?: boolean;
  postingAllowed?: boolean;
  accountEnabled?: boolean;
  requiredDimensions?: string[];
}) {
  const ruleExists = options?.ruleExists ?? true;
  const postingAllowed = options?.postingAllowed ?? true;
  const accountEnabled = options?.accountEnabled ?? true;
  const requiredDimensions = options?.requiredDimensions ?? [];

  let bookInsertCount = 0;

  return {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: any) => {
        const rows = Array.isArray(vals) ? vals : [vals];

        if (table === schema.ledgerOperations) {
          return {
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(async () => [{ id: "op-create-1" }]),
            })),
          };
        }

        if (table === schema.bookAccountInstances) {
          bookInsertCount += 1;
          return {
            onConflictDoUpdate: vi.fn(() => ({
              returning: vi.fn(async () => [
                {
                  id: `ba-${bookInsertCount}`,
                  tbLedger: rows[0]?.tbLedger ?? 1,
                  tbAccountId: rows[0]?.tbAccountId ?? BigInt(bookInsertCount),
                },
              ]),
            })),
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(async () => [
                {
                  id: `ba-${bookInsertCount}`,
                  tbLedger: rows[0]?.tbLedger ?? 1,
                  tbAccountId: rows[0]?.tbAccountId ?? BigInt(bookInsertCount),
                },
              ]),
            })),
          };
        }

        return {
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => []),
          })),
          onConflictDoUpdate: vi.fn(() => ({})),
        };
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          if (table === schema.chartAccountDimensionPolicy) {
            return Promise.resolve([]);
          }
          if (table === schema.postingCodeDimensionPolicy) {
            return Promise.resolve(
              requiredDimensions.map((dimensionKey) => ({
                dimensionKey,
                required: true,
                scope: "line",
              })),
            );
          }

          return {
            limit: vi.fn(async () => {
              if (table === schema.correspondenceRules) {
                return ruleExists ? [{ id: "rule" }] : [];
              }

              if (table === schema.chartTemplateAccounts) {
                return [{ postingAllowed, enabled: accountEnabled }];
              }

              return [];
            }),
          };
        }),
      })),
    })),
  } as any;
}

function createPostPendingInput(overrides: Record<string, unknown> = {}) {
  return createTestEntry({
    transfers: [
      {
        type: OPERATION_TRANSFER_TYPE.POST_PENDING,
        planRef: "post-1",
        currency: "USD",
        pendingId: 123n,
      },
    ],
    ...overrides,
  });
}

function createVoidPendingInput(overrides: Record<string, unknown> = {}) {
  return createTestEntry({
    transfers: [
      {
        type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
        planRef: "void-1",
        currency: "USD",
        pendingId: 456n,
      },
    ],
    ...overrides,
  });
}

describe("createLedgerEngine", () => {
  let db: StubDatabase;
  let engine: ReturnType<typeof createLedgerEngine>;

  beforeEach(() => {
    db = createSmartStubDb();
    engine = createLedgerEngine({ db });
  });

  describe("validation", () => {
    it("rejects empty transfers", async () => {
      const input = createTestEntry({ transfers: [] });
      await expect(engine.commitStandalone(input)).rejects.toThrow(
        "lines must be a non-empty array",
      );
    });

    it("rejects invalid account number format", async () => {
      const input = createTestEntry({
        transfers: [
          createTestTransferPlan({
            debitAccountNo: "12",
          }),
        ],
      });

      await expect(engine.commitStandalone(input)).rejects.toThrow(
        /accountNo must match NNNN/,
      );
    });

    it("accepts lowercase transfer currency", async () => {
      const capturedRows: any[] = [];

      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn((vals: any) => {
            const rows = Array.isArray(vals) ? vals : [vals];
            if (rows[0]?.type && rows[0]?.lineNo !== undefined) {
              capturedRows.push(...rows);
            }

            return {
              onConflictDoNothing: vi.fn(() => ({
                returning: vi.fn(async () => {
                  if (rows[0]?.idempotencyKey !== undefined) {
                    return [{ id: "op-normalized" }];
                  }
                  return [];
                }),
              })),
              onConflictDoUpdate: vi.fn(() => ({})),
            };
          }),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      } as any;

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

      const input = createPostPendingInput({
        transfers: [
          {
            type: OPERATION_TRANSFER_TYPE.POST_PENDING,
            planRef: "post-lower",
            currency: "usd",
            pendingId: 123n,
          },
        ],
      });

      await engine.commitStandalone(input);

      expect(capturedRows).toHaveLength(1);
      expect(capturedRows[0].type).toBe(OPERATION_TRANSFER_TYPE.POST_PENDING);
    });
  });

  describe("chain validation", () => {
    it("accepts contiguous chains", async () => {
      const input = createTestEntry({
        transfers: [
          {
            type: OPERATION_TRANSFER_TYPE.POST_PENDING,
            planRef: "p1",
            currency: "USD",
            pendingId: 10n,
            chain: "chain-a",
          },
          {
            type: OPERATION_TRANSFER_TYPE.POST_PENDING,
            planRef: "p2",
            currency: "USD",
            pendingId: 11n,
            chain: "chain-a",
          },
        ],
      });

      await expect(engine.commitStandalone(input)).resolves.toBeDefined();
    });

    it("rejects non-contiguous chains", async () => {
      const input = createTestEntry({
        transfers: [
          {
            type: OPERATION_TRANSFER_TYPE.POST_PENDING,
            planRef: "p1",
            currency: "USD",
            pendingId: 10n,
            chain: "chain-a",
          },
          {
            type: OPERATION_TRANSFER_TYPE.POST_PENDING,
            planRef: "p2",
            currency: "USD",
            pendingId: 11n,
          },
          {
            type: OPERATION_TRANSFER_TYPE.POST_PENDING,
            planRef: "p3",
            currency: "USD",
            pendingId: 12n,
            chain: "chain-a",
          },
        ],
      });

      await expect(engine.commitStandalone(input)).rejects.toThrow(
        /Non-contiguous chain block/,
      );
    });
  });

  describe("linked flag computation", () => {
    it("sets linked flags for separate chain blocks", async () => {
      const capturedRows: any[] = [];

      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn((vals: any) => {
            const rows = Array.isArray(vals) ? vals : [vals];
            if (rows[0]?.type && rows[0]?.lineNo !== undefined) {
              capturedRows.push(...rows);
            }

            return {
              onConflictDoNothing: vi.fn(() => ({
                returning: vi.fn(async () => {
                  if (rows[0]?.idempotencyKey !== undefined) {
                    return [{ id: "op-linked" }];
                  }
                  return [];
                }),
              })),
              onConflictDoUpdate: vi.fn(() => ({})),
            };
          }),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      } as any;

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

      const input = createTestEntry({
        transfers: [
          {
            type: OPERATION_TRANSFER_TYPE.POST_PENDING,
            planRef: "a1",
            currency: "USD",
            pendingId: 10n,
            chain: "chain-a",
          },
          {
            type: OPERATION_TRANSFER_TYPE.POST_PENDING,
            planRef: "a2",
            currency: "USD",
            pendingId: 11n,
            chain: "chain-a",
          },
          {
            type: OPERATION_TRANSFER_TYPE.POST_PENDING,
            planRef: "b1",
            currency: "USD",
            pendingId: 12n,
            chain: "chain-b",
          },
          {
            type: OPERATION_TRANSFER_TYPE.POST_PENDING,
            planRef: "b2",
            currency: "USD",
            pendingId: 13n,
            chain: "chain-b",
          },
        ],
      });

      await engine.commitStandalone(input);

      expect(capturedRows).toHaveLength(4);
      expect(capturedRows[0].isLinked).toBe(true);
      expect(capturedRows[1].isLinked).toBe(false);
      expect(capturedRows[2].isLinked).toBe(true);
      expect(capturedRows[3].isLinked).toBe(false);
    });
  });

  describe("idempotency", () => {
    it("returns existing operation for duplicate idempotency key", async () => {
      let insertedPayloadHash = "";

      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn((vals: any) => {
            const row = Array.isArray(vals) ? vals[0] : vals;
            if (row?.idempotencyKey !== undefined) {
              insertedPayloadHash = row.payloadHash;
            }

            return {
              onConflictDoNothing: vi.fn(() => ({
                returning: vi.fn(async () => {
                  if (row?.idempotencyKey !== undefined) {
                    return [];
                  }
                  return [];
                }),
              })),
              onConflictDoUpdate: vi.fn(() => ({})),
            };
          }),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                {
                  id: "existing-op",
                  payloadHash: insertedPayloadHash,
                },
              ]),
            })),
          })),
        })),
      } as any;

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

      const result = await engine.commitStandalone(createPostPendingInput());
      expect(result.operationId).toBe("existing-op");
    });

    it("throws conflict when payload hash differs", async () => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(async () => []),
            })),
            onConflictDoUpdate: vi.fn(() => ({})),
          })),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                {
                  id: "existing-op",
                  payloadHash: "different-hash",
                },
              ]),
            })),
          })),
        })),
      } as any;

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

      await expect(
        engine.commitStandalone(createPostPendingInput()),
      ).rejects.toThrow(IdempotencyConflictError);
    });

    it("throws when idempotency conflict row is missing", async () => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(async () => []),
            })),
            onConflictDoUpdate: vi.fn(() => ({})),
          })),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      } as any;

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

      await expect(
        engine.commitStandalone(createPostPendingInput()),
      ).rejects.toThrow("Idempotency conflict but operation not found");
    });

    it("creates a new operation on first request", async () => {
      const result = await engine.commitStandalone(createPostPendingInput());

      expect(result.operationId).toBe("test-operation-id");
      expect(result.pendingTransferIdsByRef).toBeInstanceOf(Map);
      expect(result.pendingTransferIdsByRef.size).toBe(0);
    });

    it("creates a void_pending transfer plan row", async () => {
      const capturedRows: any[] = [];

      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn((vals: any) => {
            const rows = Array.isArray(vals) ? vals : [vals];
            if (rows[0]?.type && rows[0]?.lineNo !== undefined) {
              capturedRows.push(...rows);
            }

            return {
              onConflictDoNothing: vi.fn(() => ({
                returning: vi.fn(async () => {
                  if (rows[0]?.idempotencyKey !== undefined) {
                    return [{ id: "op-void" }];
                  }
                  return [];
                }),
              })),
              onConflictDoUpdate: vi.fn(() => ({})),
            };
          }),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      } as any;

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

      await engine.commitStandalone(createVoidPendingInput());

      expect(capturedRows).toHaveLength(1);
      expect(capturedRows[0].type).toBe(OPERATION_TRANSFER_TYPE.VOID_PENDING);
      expect(capturedRows[0].amount).toBe(0n);
    });
  });

  describe("create transfer branches", () => {
    it("creates pending transfer and returns ref mapping", async () => {
      const tx = createCreateTransferTx();
      vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

      const result = await engine.commitStandalone(
        createTestEntry({
          transfers: [
            createTestTransferPlan({
              pending: { timeoutSeconds: 120, ref: "pending-ref-1" },
            }),
          ],
        }),
      );

      expect(result.operationId).toBe("op-create-1");
      expect(result.pendingTransferIdsByRef.has("pending-ref-1")).toBe(true);
    });

    it("does not re-run accounting policy checks during ledger commit", async () => {
      const tx = createCreateTransferTx({
        ruleExists: false,
        postingAllowed: false,
        accountEnabled: false,
        requiredDimensions: ["customerId"],
      });
      vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

      await expect(
        engine.commitStandalone(
          createTestEntry({
            transfers: [
              createTestTransferPlan({
                analytics: {},
              }),
            ],
          }),
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          operationId: "op-create-1",
          pendingTransferIdsByRef: expect.any(Map),
        }),
      );
    });
  });
});
