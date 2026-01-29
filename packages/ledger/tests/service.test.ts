import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@repo/kernel";
import { createLedgerService, type LedgerServiceDeps } from "../src/service.js";
import { accountRefKey, type AccountRef, type PostRequest } from "../src/contract.js";
import { tbAccountIdFromKey } from "../src/ids.js";
import {
  createMockLogger,
  createMockTbAdapter,
  createMockAccountStore,
  testRefs,
  addMapping,
} from "./helpers.js";

describe("createLedgerService", () => {
  let deps: LedgerServiceDeps;
  let mockTb: ReturnType<typeof createMockTbAdapter>;
  let mockStore: ReturnType<typeof createMockAccountStore>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockTb = createMockTbAdapter();
    mockStore = createMockAccountStore();
    mockLogger = createMockLogger();

    deps = {
      tb: mockTb,
      accountStore: mockStore,
      logger: mockLogger,
      ledgerForCurrency: (currency: string) => (currency === "USD" ? 1 : currency === "EUR" ? 2 : 99),
      defaultAccountCode: 1,
    };
  });

  describe("resolveAccount", () => {
    it("returns resolved account when mapping exists", async () => {
      const ref = testRefs.customer("cust_123", "USD");
      const tbAccountId = 123n;
      const tbLedger = 1;

      addMapping(mockStore, ref, { tbAccountId, tbLedger });

      const service = createLedgerService(deps);
      const result = await service.resolveAccount(ref);

      expect(result).toEqual({
        ref,
        tbAccountId,
        tbLedger,
      });
    });

    it("throws ACCOUNT_NOT_FOUND when mapping does not exist", async () => {
      const ref = testRefs.customer("nonexistent", "USD");
      const service = createLedgerService(deps);

      await expect(service.resolveAccount(ref)).rejects.toThrow(AppError);
      await expect(service.resolveAccount(ref)).rejects.toMatchObject({
        code: "ACCOUNT_NOT_FOUND",
      });
    });
  });

  describe("ensureAccount", () => {
    it("creates TB account and PG mapping for new account", async () => {
      const ref = testRefs.customer("cust_new", "USD");
      const service = createLedgerService(deps);

      const result = await service.ensureAccount(ref);

      // Should have called TB createAccounts
      expect(mockTb.createAccounts).toHaveBeenCalledTimes(1);
      expect(mockTb.createAccounts).toHaveBeenCalledWith([
        expect.objectContaining({
          id: expect.any(BigInt),
          ledger: 1, // USD ledger
          code: 10, // customer default code
        }),
      ]);

      // Should have called accountStore upsert
      expect(mockStore.upsert).toHaveBeenCalledTimes(1);

      expect(result.ref).toEqual(ref);
      expect(result.tbLedger).toBe(1);
    });

    it("returns existing account without error when already exists", async () => {
      const ref = testRefs.customer("cust_existing", "USD");
      const tbAccountId = tbAccountIdFromKey(accountRefKey(ref));
      const tbLedger = 1;

      // Pre-populate the store
      addMapping(mockStore, ref, { tbAccountId, tbLedger });

      const service = createLedgerService(deps);
      const result = await service.ensureAccount(ref);

      expect(result.tbAccountId).toBe(tbAccountId);
      expect(result.tbLedger).toBe(tbLedger);
    });

    it("throws LEDGER_MAPPING_CONFLICT when IDs don't match", async () => {
      const ref = testRefs.customer("cust_conflict", "USD");

      // Pre-populate with different ID
      addMapping(mockStore, ref, { tbAccountId: 999n, tbLedger: 1 });

      const service = createLedgerService(deps);

      await expect(service.ensureAccount(ref)).rejects.toMatchObject({
        code: "LEDGER_MAPPING_CONFLICT",
      });
    });

    it("uses custom accountCodeFor when provided", async () => {
      const ref = testRefs.customer("cust_custom_code", "USD");
      deps.accountCodeFor = vi.fn(() => 42);

      const service = createLedgerService(deps);
      await service.ensureAccount(ref);

      expect(deps.accountCodeFor).toHaveBeenCalledWith(ref);
      expect(mockTb.createAccounts).toHaveBeenCalledWith([
        expect.objectContaining({ code: 42 }),
      ]);
    });

    it("uses correct default codes per account kind", async () => {
      const service = createLedgerService(deps);

      // Customer = 10
      await service.ensureAccount(testRefs.customer("c1", "USD"));
      expect(mockTb.createAccounts).toHaveBeenLastCalledWith([
        expect.objectContaining({ code: 10 }),
      ]);

      // Internal = 20
      await service.ensureAccount(testRefs.internal("fees", "USD"));
      expect(mockTb.createAccounts).toHaveBeenLastCalledWith([
        expect.objectContaining({ code: 20 }),
      ]);

      // Global Ledger = 30
      await service.ensureAccount(testRefs.globalLedger("REVENUE", "USD"));
      expect(mockTb.createAccounts).toHaveBeenLastCalledWith([
        expect.objectContaining({ code: 30 }),
      ]);
    });

    it("respects history option", async () => {
      const ref = testRefs.customer("cust_history", "USD");
      const service = createLedgerService(deps);

      await service.ensureAccount(ref, { history: true });

      // AccountFlags.history = 8 in TigerBeetle (0b1000)
      expect(mockTb.createAccounts).toHaveBeenCalledWith([
        expect.objectContaining({ flags: 8 }),
      ]);
    });

    it("respects enableHistoryByDefault", async () => {
      deps.enableHistoryByDefault = true;
      const ref = testRefs.customer("cust_default_history", "USD");
      const service = createLedgerService(deps);

      await service.ensureAccount(ref);

      expect(mockTb.createAccounts).toHaveBeenCalledWith([
        expect.objectContaining({ flags: 8 }),
      ]);
    });
  });

  describe("transfer", () => {
    it("creates transfer between existing accounts", async () => {
      const debit = testRefs.customer("sender", "USD");
      const credit = testRefs.customer("receiver", "USD");

      addMapping(mockStore, debit, { tbAccountId: 100n, tbLedger: 1 });
      addMapping(mockStore, credit, { tbAccountId: 200n, tbLedger: 1 });

      const service = createLedgerService(deps);
      const result = await service.transfer({
        debit,
        credit,
        amount: 1000n,
        code: 1,
      });

      expect(result.id).toBeDefined();
      expect(mockTb.createTransfers).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            debitAccountId: 100n,
            creditAccountId: 200n,
            amount: 1000n,
            ledger: 1,
            code: 1,
          }),
        ],
        { allowExists: false } // No ID provided, so new transfer
      );
    });

    it("uses provided ID and allows exists for idempotency", async () => {
      const debit = testRefs.customer("sender", "USD");
      const credit = testRefs.customer("receiver", "USD");

      addMapping(mockStore, debit, { tbAccountId: 100n, tbLedger: 1 });
      addMapping(mockStore, credit, { tbAccountId: 200n, tbLedger: 1 });

      const service = createLedgerService(deps);
      const result = await service.transfer({
        id: 999n,
        debit,
        credit,
        amount: 500n,
        code: 1,
      });

      expect(result.id).toBe(999n);
      expect(mockTb.createTransfers).toHaveBeenCalledWith(
        [expect.objectContaining({ id: 999n })],
        { allowExists: true } // ID provided, allow exists
      );
    });

    it("throws LEDGER_INVALID_AMOUNT for zero amount", async () => {
      const debit = testRefs.customer("sender", "USD");
      const credit = testRefs.customer("receiver", "USD");
      const service = createLedgerService(deps);

      await expect(
        service.transfer({ debit, credit, amount: 0n, code: 1 })
      ).rejects.toMatchObject({ code: "LEDGER_INVALID_AMOUNT" });
    });

    it("throws LEDGER_INVALID_AMOUNT for negative amount", async () => {
      const debit = testRefs.customer("sender", "USD");
      const credit = testRefs.customer("receiver", "USD");
      const service = createLedgerService(deps);

      await expect(
        service.transfer({ debit, credit, amount: -100n, code: 1 })
      ).rejects.toMatchObject({ code: "LEDGER_INVALID_AMOUNT" });
    });

    it("throws LEDGER_CURRENCY_MISMATCH for different currencies", async () => {
      const debit = testRefs.customer("sender", "USD");
      const credit = testRefs.customer("receiver", "EUR");
      const service = createLedgerService(deps);

      await expect(
        service.transfer({ debit, credit, amount: 100n, code: 1 })
      ).rejects.toMatchObject({ code: "LEDGER_CURRENCY_MISMATCH" });
    });

    it("throws ACCOUNT_NOT_FOUND when debit account missing", async () => {
      const debit = testRefs.customer("missing", "USD");
      const credit = testRefs.customer("receiver", "USD");

      addMapping(mockStore, credit, { tbAccountId: 200n, tbLedger: 1 });

      const service = createLedgerService(deps);

      await expect(
        service.transfer({ debit, credit, amount: 100n, code: 1 })
      ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    });

    it("throws LEDGER_MISMATCH when accounts are in different TB ledgers", async () => {
      const debit = testRefs.customer("sender", "USD");
      const credit = testRefs.customer("receiver", "USD");

      // Same currency but different TB ledgers (shouldn't happen in practice)
      addMapping(mockStore, debit, { tbAccountId: 100n, tbLedger: 1 });
      addMapping(mockStore, credit, { tbAccountId: 200n, tbLedger: 2 });

      const service = createLedgerService(deps);

      await expect(
        service.transfer({ debit, credit, amount: 100n, code: 1 })
      ).rejects.toMatchObject({ code: "LEDGER_MISMATCH" });
    });
  });

  describe("post", () => {
    it("creates multiple transfers in a batch", async () => {
      const alice = testRefs.customer("alice", "USD");
      const bob = testRefs.customer("bob", "USD");
      const charlie = testRefs.customer("charlie", "USD");

      addMapping(mockStore, alice, { tbAccountId: 1n, tbLedger: 1 });
      addMapping(mockStore, bob, { tbAccountId: 2n, tbLedger: 1 });
      addMapping(mockStore, charlie, { tbAccountId: 3n, tbLedger: 1 });

      const req: PostRequest = {
        mode: "single",
        transfers: [
          { id: 100n, debit: alice, credit: bob, amount: 500n, code: 1 },
          { id: 101n, debit: bob, credit: charlie, amount: 300n, code: 1 },
        ],
      };

      const service = createLedgerService(deps);
      const result = await service.post(req);

      expect(result.transferIds).toEqual([100n, 101n]);
      expect(result.submitted).toHaveLength(2);
      expect(mockTb.createTransfers).toHaveBeenCalledTimes(1);
      expect(mockTb.createTransfers).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 100n }),
          expect.objectContaining({ id: 101n }),
        ]),
        { allowExists: true }
      );
    });

    it("sets linked flag for linked_chain mode", async () => {
      const alice = testRefs.customer("alice", "USD");
      const bob = testRefs.customer("bob", "USD");
      const charlie = testRefs.customer("charlie", "USD");

      addMapping(mockStore, alice, { tbAccountId: 1n, tbLedger: 1 });
      addMapping(mockStore, bob, { tbAccountId: 2n, tbLedger: 1 });
      addMapping(mockStore, charlie, { tbAccountId: 3n, tbLedger: 1 });

      const req: PostRequest = {
        mode: "linked_chain",
        transfers: [
          { id: 100n, debit: alice, credit: bob, amount: 500n, code: 1 },
          { id: 101n, debit: bob, credit: charlie, amount: 300n, code: 1 },
        ],
      };

      const service = createLedgerService(deps);
      await service.post(req);

      // TransferFlags.linked = 1
      const calls = mockTb.createTransfers.mock.calls[0][0];
      expect(calls[0].flags).toBe(1); // First transfer linked
      expect(calls[1].flags).toBe(0); // Last transfer not linked
    });

    it("throws LEDGER_INVALID_POST for empty transfers", async () => {
      const req: PostRequest = { mode: "single", transfers: [] };
      const service = createLedgerService(deps);

      await expect(service.post(req)).rejects.toMatchObject({
        code: "LEDGER_INVALID_POST",
      });
    });

    it("throws LEDGER_INVALID_AMOUNT for zero amount in batch", async () => {
      const alice = testRefs.customer("alice", "USD");
      const bob = testRefs.customer("bob", "USD");

      const req: PostRequest = {
        mode: "single",
        transfers: [{ id: 100n, debit: alice, credit: bob, amount: 0n, code: 1 }],
      };

      const service = createLedgerService(deps);

      await expect(service.post(req)).rejects.toMatchObject({
        code: "LEDGER_INVALID_AMOUNT",
      });
    });

    it("throws ACCOUNT_NOT_FOUND when any account is missing", async () => {
      const alice = testRefs.customer("alice", "USD");
      const bob = testRefs.customer("bob", "USD");

      // Only add alice
      addMapping(mockStore, alice, { tbAccountId: 1n, tbLedger: 1 });

      const req: PostRequest = {
        mode: "single",
        transfers: [{ id: 100n, debit: alice, credit: bob, amount: 100n, code: 1 }],
      };

      const service = createLedgerService(deps);

      await expect(service.post(req)).rejects.toMatchObject({
        code: "ACCOUNT_NOT_FOUND",
      });
    });

    it("batches account lookups efficiently", async () => {
      const alice = testRefs.customer("alice", "USD");
      const bob = testRefs.customer("bob", "USD");

      addMapping(mockStore, alice, { tbAccountId: 1n, tbLedger: 1 });
      addMapping(mockStore, bob, { tbAccountId: 2n, tbLedger: 1 });

      const req: PostRequest = {
        mode: "single",
        transfers: [
          { id: 100n, debit: alice, credit: bob, amount: 100n, code: 1 },
          { id: 101n, debit: alice, credit: bob, amount: 200n, code: 1 },
          { id: 102n, debit: bob, credit: alice, amount: 50n, code: 1 },
        ],
      };

      const service = createLedgerService(deps);
      await service.post(req);

      // Should only call getMany once, not per-transfer
      expect(mockStore.getMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("getBalance", () => {
    it("returns balance for existing account", async () => {
      const ref = testRefs.customer("cust_123", "USD");
      addMapping(mockStore, ref, { tbAccountId: 100n, tbLedger: 1 });

      mockTb.lookupAccounts = vi.fn().mockResolvedValue([
        {
          id: 100n,
          debitsPosted: 1000n,
          creditsPosted: 500n,
          debitsPending: 0n,
          creditsPending: 0n,
          ledger: 1,
          code: 10,
          flags: 0,
        },
      ]);

      const service = createLedgerService(deps);
      const result = await service.getBalance(ref);

      expect(result).toEqual({
        ref,
        tbAccountId: 100n,
        debitsPosted: 1000n,
        creditsPosted: 500n,
        debitsPending: 0n,
        creditsPending: 0n,
      });
    });

    it("throws ACCOUNT_NOT_FOUND when mapping missing", async () => {
      const ref = testRefs.customer("nonexistent", "USD");
      const service = createLedgerService(deps);

      await expect(service.getBalance(ref)).rejects.toMatchObject({
        code: "ACCOUNT_NOT_FOUND",
      });
    });

    it("throws TB_ACCOUNT_MISSING when TB account not found", async () => {
      const ref = testRefs.customer("orphaned", "USD");
      addMapping(mockStore, ref, { tbAccountId: 100n, tbLedger: 1 });

      mockTb.lookupAccounts = vi.fn().mockResolvedValue([]);

      const service = createLedgerService(deps);

      await expect(service.getBalance(ref)).rejects.toMatchObject({
        code: "TB_ACCOUNT_MISSING",
      });
    });
  });

  describe("getBalances", () => {
    it("returns balances for multiple accounts", async () => {
      const alice = testRefs.customer("alice", "USD");
      const bob = testRefs.customer("bob", "USD");

      addMapping(mockStore, alice, { tbAccountId: 1n, tbLedger: 1 });
      addMapping(mockStore, bob, { tbAccountId: 2n, tbLedger: 1 });

      mockTb.lookupAccounts = vi.fn().mockResolvedValue([
        { id: 1n, debitsPosted: 100n, creditsPosted: 50n, debitsPending: 0n, creditsPending: 0n },
        { id: 2n, debitsPosted: 200n, creditsPosted: 150n, debitsPending: 0n, creditsPending: 0n },
      ]);

      const service = createLedgerService(deps);
      const results = await service.getBalances([alice, bob]);

      expect(results).toHaveLength(2);
      expect(results[0].ref).toEqual(alice);
      expect(results[1].ref).toEqual(bob);
    });

    it("returns empty array for empty input", async () => {
      const service = createLedgerService(deps);
      const results = await service.getBalances([]);

      expect(results).toEqual([]);
      expect(mockStore.getMany).not.toHaveBeenCalled();
    });

    it("uses getMany for batch lookup", async () => {
      const alice = testRefs.customer("alice", "USD");
      const bob = testRefs.customer("bob", "USD");

      addMapping(mockStore, alice, { tbAccountId: 1n, tbLedger: 1 });
      addMapping(mockStore, bob, { tbAccountId: 2n, tbLedger: 1 });

      mockTb.lookupAccounts = vi.fn().mockResolvedValue([
        { id: 1n, debitsPosted: 0n, creditsPosted: 0n, debitsPending: 0n, creditsPending: 0n },
        { id: 2n, debitsPosted: 0n, creditsPosted: 0n, debitsPending: 0n, creditsPending: 0n },
      ]);

      const service = createLedgerService(deps);
      await service.getBalances([alice, bob]);

      // Should use batch getMany, not individual get calls
      expect(mockStore.getMany).toHaveBeenCalledTimes(1);
      expect(mockStore.get).not.toHaveBeenCalled();
    });

    it("throws ACCOUNT_NOT_FOUND when any account missing", async () => {
      const alice = testRefs.customer("alice", "USD");
      const bob = testRefs.customer("bob", "USD");

      // Only add alice
      addMapping(mockStore, alice, { tbAccountId: 1n, tbLedger: 1 });

      const service = createLedgerService(deps);

      await expect(service.getBalances([alice, bob])).rejects.toMatchObject({
        code: "ACCOUNT_NOT_FOUND",
      });
    });
  });
});
