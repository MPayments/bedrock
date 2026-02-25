import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSmartStubDb,
  createTestEntry,
  createTestTransferPlan,
  type StubDatabase,
} from "./helpers";
import { createLedgerEngine } from "../src/engine";
import { IdempotencyConflictError } from "../src/errors";
import { OPERATION_TRANSFER_TYPE } from "../src/types";

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
      await expect(engine.createOperation(input)).rejects.toThrow(
        "transfers must be a non-empty array",
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

      await expect(engine.createOperation(input)).rejects.toThrow(
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

      await engine.createOperation(input);

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

      await expect(engine.createOperation(input)).resolves.toBeDefined();
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

      await expect(engine.createOperation(input)).rejects.toThrow(
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

      await engine.createOperation(input);

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

      const result = await engine.createOperation(createPostPendingInput());
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
        engine.createOperation(createPostPendingInput()),
      ).rejects.toThrow(IdempotencyConflictError);
    });

    it("creates a new operation on first request", async () => {
      const result = await engine.createOperation(createPostPendingInput());

      expect(result.operationId).toBe("test-operation-id");
      expect(result.pendingTransferIdsByRef).toBeInstanceOf(Map);
      expect(result.pendingTransferIdsByRef.size).toBe(0);
    });
  });
});
