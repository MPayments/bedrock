import { describe, it, expect, vi, beforeEach } from "vitest";

import { ACCOUNT_NO } from "@bedrock/accounting";
import { createFeesService } from "@bedrock/fees";

import {
  createStubDb,
  createMockLedger,
  createMockOrder,
  CUSTOMER_ID,
  ORDER_ID,
  BRANCH_COUNTERPARTY_ID,
  BANK_ACCOUNT_ID,
  type StubDatabase,
} from "./helpers";
import {
  NotFoundError,
  InvalidStateError,
  CurrencyMismatchError,
  AmountMismatchError,
  ValidationError,
} from "../src/errors";
import { createTreasuryService } from "../src/service";

function createMockCurrenciesService() {
  const byCode = new Map<string, any>([
    ["USD", { id: "cur-usd", code: "USD" }],
    ["EUR", { id: "cur-eur", code: "EUR" }],
    ["GBP", { id: "cur-gbp", code: "GBP" }],
    ["RUB", { id: "cur-rub", code: "RUB" }],
    ["AED", { id: "cur-aed", code: "AED" }],
    ["USDT", { id: "cur-usdt", code: "USDT" }],
    ["BTC", { id: "cur-btc", code: "BTC" }],
  ]);
  const byId = new Map<string, any>(
    Array.from(byCode.values()).map((currency) => [currency.id, currency]),
  );

  return {
    findByCode: vi.fn(async (code: string) => {
      const normalized = code.trim().toUpperCase();
      const existing = byCode.get(normalized);
      if (existing) return existing;
      const generated = {
        id: `cur-${normalized.toLowerCase()}`,
        code: normalized,
      };
      byCode.set(normalized, generated);
      byId.set(generated.id, generated);
      return generated;
    }),
    findById: vi.fn(async (id: string) => {
      const existing = byId.get(id);
      if (existing) return existing;
      throw new Error(`Unknown currency id: ${id}`);
    }),
  };
}

describe("createTreasuryService", () => {
  let db: StubDatabase;
  let ledger: ReturnType<typeof createMockLedger>;
  let service: ReturnType<typeof createTreasuryService>;

  function selectReturning(rows: any[]) {
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => rows),
        })),
      })),
    };
  }

  function updateReturning(rows: any[]) {
    return {
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => rows),
        })),
      })),
    };
  }

  beforeEach(() => {
    db = createStubDb();
    ledger = createMockLedger();
    const currenciesService = createMockCurrenciesService();
    const feesService = createFeesService({ db, currenciesService });
    service = createTreasuryService({
      db,
      ledger,
      feesService,
      currenciesService,
    });
  });

  describe("fundingSettled", () => {
    const validInput = {
      orderId: ORDER_ID,
      branchCounterpartyId: BRANCH_COUNTERPARTY_ID,
      branchBankStableKey: "bank-key-123",
      customerId: CUSTOMER_ID,
      currency: "USD",
      amountMinor: 100000n,
      railRef: "rail-ref-123",
      occurredAt: new Date(),
    };

    it("should process funding settled successfully", async () => {
      const order = createMockOrder({
        status: "quote",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
      });

      // Setup mock for transaction
      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn(async () => [{ id: ORDER_ID }]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      const result = await service.fundingSettled(validInput);

      expect(result).toBe("test-entry-id");
      expect(ledger.createEntryTx).toHaveBeenCalled();
    });

    it("should throw NotFoundError when order not found", async () => {
      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => []),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.fundingSettled(validInput)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should throw CurrencyMismatchError when currency doesn't match", async () => {
      const order = createMockOrder({
        payInCurrency: "EUR", // Different from input
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.fundingSettled(validInput)).rejects.toThrow(
        CurrencyMismatchError,
      );
    });

    it("should throw AmountMismatchError when amount doesn't match", async () => {
      const order = createMockOrder({
        payInCurrency: "USD",
        payInExpectedMinor: 50000n, // Different from input
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.fundingSettled(validInput)).rejects.toThrow(
        AmountMismatchError,
      );
    });

    it("should throw ValidationError when customerId doesn't match", async () => {
      const order = createMockOrder({
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        customerId: "550e8400-e29b-41d4-a716-446655440099", // Different
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.fundingSettled(validInput)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should be idempotent when order is already advanced", async () => {
      const order = createMockOrder({
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        status: "funding_settled",
        ledgerEntryId: "existing-entry-id",
      });
      vi.mocked(ledger.createEntryTx).mockResolvedValueOnce({
        entryId: "existing-entry-id",
        transferIds: new Map<number, bigint>(),
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn(async () => []), // No rows updated
              })),
            })),
          })),
        };
        return fn(tx);
      });

      const result = await service.fundingSettled(validInput);

      // Should return existing entry ID (idempotent)
      expect(result).toBe("existing-entry-id");
    });

    it("should throw InvalidStateError when order advanced with different ledger entry id", async () => {
      const order = createMockOrder({
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        status: "funding_settled",
        ledgerEntryId: "different-entry-id",
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn(async () => []),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.fundingSettled(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should throw ValidationError when branchCounterpartyId doesn't match order payInCounterpartyId", async () => {
      const order = createMockOrder({
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payInCounterpartyId: "550e8400-e29b-41d4-a716-446655440099",
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.fundingSettled(validInput)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw InvalidStateError when CAS fails and order is in non-advanceable state", async () => {
      // Order is in "quote" initially, CAS update fails, and re-fetch shows still "quote"
      // This should throw because "quote" is not in advancedStatuses
      const order = createMockOrder({
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        status: "quote",
      });

      const current = createMockOrder({
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        status: "quote", // Still in quote - neither advanced nor advanceable
        ledgerEntryId: null,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi
            .fn()
            .mockImplementationOnce(() => selectReturning([order]))
            .mockImplementationOnce(() => selectReturning([current])),
          update: vi.fn(() => updateReturning([])), // CAS failure
        };
        return fn(tx);
      });

      await expect(service.fundingSettled(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });
  });

  describe("executeFx", () => {
    const validInput = {
      orderId: ORDER_ID,
      branchCounterpartyId: BRANCH_COUNTERPARTY_ID,
      customerId: CUSTOMER_ID,
      payInCurrency: "USD",
      principalMinor: 100000n,
      payOutCurrency: "EUR",
      payOutAmountMinor: 85000n,
      occurredAt: new Date(),
      quoteRef: "quote-ref-123",
    };

    function currencyIdFromCode(code: string): string {
      return `cur-${code.trim().toLowerCase()}`;
    }

    function createFxQuote(overrides: Record<string, any> = {}) {
      const quote = {
        id: "550e8400-e29b-41d4-a716-446655440010",
        idempotencyKey: validInput.quoteRef,
        fromCurrencyId: currencyIdFromCode(validInput.payInCurrency),
        toCurrencyId: currencyIdFromCode(validInput.payOutCurrency),
        fromCurrency: validInput.payInCurrency,
        toCurrency: validInput.payOutCurrency,
        fromAmountMinor: validInput.principalMinor,
        toAmountMinor: validInput.payOutAmountMinor,
        status: "active",
        usedByRef: null,
        usedAt: null,
        expiresAt: new Date(validInput.occurredAt.getTime() + 60_000),
        ...overrides,
      };

      if (overrides.fromCurrency && !overrides.fromCurrencyId) {
        quote.fromCurrencyId = currencyIdFromCode(overrides.fromCurrency);
      }

      if (overrides.toCurrency && !overrides.toCurrencyId) {
        quote.toCurrencyId = currencyIdFromCode(overrides.toCurrency);
      }

      return quote;
    }

    function selectSequence(rowsByCall: any[][]) {
      const select = vi.fn();
      for (const rows of rowsByCall) {
        select.mockImplementationOnce(() => selectReturning(rows));
      }
      // Any additional selects default to empty result set.
      select.mockImplementation(() => selectReturning([]));
      return select;
    }

    function updateSequence(rowsByCall: any[][]) {
      const update = vi.fn();
      for (const rows of rowsByCall) {
        update.mockReturnValueOnce(updateReturning(rows));
      }
      return update;
    }

    function insertNoop() {
      return vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => []),
        })),
      }));
    }

    it("should execute FX successfully", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
            [{ id: ORDER_ID }],
          ]),
        };
        return fn(tx);
      });

      const result = await service.executeFx(validInput);

      expect(result).toBe("test-entry-id");
      expect(ledger.createEntryTx).toHaveBeenCalled();
    });

    it("should reject explicit-route quote when persisted legs are missing", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote({ pricingMode: "explicit_route" });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote], []]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
          ]),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        InvalidStateError,
      );
      expect(ledger.createEntryTx).not.toHaveBeenCalled();
    });

    it("should post intercompany legs against order pay-in/pay-out orgs when they differ", async () => {
      const payInCounterpartyId = "550e8400-e29b-41d4-a716-446655440011";
      const payOutCounterpartyId = "550e8400-e29b-41d4-a716-446655440012";
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
        payInCounterpartyId,
        payOutCounterpartyId,
      });
      const quote = createFxQuote();

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
            [{ id: ORDER_ID }],
          ]),
        };
        return fn(tx);
      });

      await service.executeFx({
        ...validInput,
        branchCounterpartyId: payInCounterpartyId,
      });

      const transfers = vi.mocked(ledger.createEntryTx).mock.calls[0]![1]
        .transfers;
      const legOut = transfers.find((t: any) => t.memo === "FX leg 1 out");
      const legIn = transfers.find((t: any) => t.memo === "FX leg 1 in");
      const payoutObligation = transfers.find(
        (t: any) => t.memo === "Create payout obligation",
      );

      expect(legOut).toBeDefined();
      expect(legOut.creditAccountNo).toBe(ACCOUNT_NO.TREASURY_CLEARING);
      expect(legOut.analytics?.counterpartyId).toBe(payInCounterpartyId);
      expect(legIn).toBeDefined();
      expect(legIn.debitAccountNo).toBe(ACCOUNT_NO.TREASURY_CLEARING);
      expect(legIn.analytics?.counterpartyId).toBe(payInCounterpartyId);
      expect(payoutObligation).toBeDefined();
      expect(payoutObligation.debitAccountNo).toBe(ACCOUNT_NO.ORDER_RESERVE);
      expect(legOut.analytics?.counterpartyId).not.toBe(payOutCounterpartyId);
      expect(legIn.analytics?.counterpartyId).not.toBe(payOutCounterpartyId);
    });

    it("should reject ambiguous UUID quoteRef between id and idempotency key", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const uuidQuoteRef = "550e8400-e29b-41d4-a716-446655440099";
      const byId = createFxQuote({
        id: uuidQuoteRef,
        idempotencyKey: "idem-1",
      });
      const byIdempotency = createFxQuote({
        id: "quote-other",
        idempotencyKey: uuidQuoteRef,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [byId], [byIdempotency]]),
          update: vi.fn(),
        };
        return fn(tx);
      });

      await expect(
        service.executeFx({ ...validInput, quoteRef: uuidQuoteRef }),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError when quote is missing", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], []]),
          update: vi.fn(),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        NotFoundError,
      );
    });

    it.each([
      {
        label: "fromCurrency mismatch",
        overrides: { fromCurrency: "GBP" },
        error: CurrencyMismatchError,
      },
      {
        label: "toCurrency mismatch",
        overrides: { toCurrency: "USD" },
        error: CurrencyMismatchError,
      },
      {
        label: "fromAmountMinor mismatch",
        overrides: { fromAmountMinor: 999n },
        error: AmountMismatchError,
      },
      {
        label: "toAmountMinor mismatch",
        overrides: { toAmountMinor: 999n },
        error: AmountMismatchError,
      },
    ])("should reject quote with $label", async ({ overrides, error }) => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote(overrides);

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: vi.fn(),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(error);
    });

    it("should reject quotes that are not active", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote({ status: "cancelled" });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: vi.fn(),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should throw NotFoundError when order not found", async () => {
      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => []),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should throw InvalidStateError when order is not funding_settled", async () => {
      const order = createMockOrder({
        status: "quote",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should throw CurrencyMismatchError when payInCurrency doesn't match", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "EUR",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([order])),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        CurrencyMismatchError,
      );
    });

    it("should throw CurrencyMismatchError when payOutCurrency doesn't match", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "GBP",
        payOutAmountMinor: 85000n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([order])),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        CurrencyMismatchError,
      );
    });

    it("should throw AmountMismatchError when principalMinor doesn't match", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 50000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([order])),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        AmountMismatchError,
      );
    });

    it("should throw AmountMismatchError when payOutAmountMinor doesn't match", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 42000n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([order])),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        AmountMismatchError,
      );
    });

    it("should throw ValidationError when customerId doesn't match order", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
        customerId: "550e8400-e29b-41d4-a716-446655440099",
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([order])),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError when branchCounterpartyId doesn't match order branch orgs", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
        payInCounterpartyId: "550e8400-e29b-41d4-a716-446655440099",
        payOutCounterpartyId: "550e8400-e29b-41d4-a716-446655440098",
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([order])),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should reject expired FX quote", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote({
        expiresAt: new Date(Date.now() - 5_000),
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: vi.fn(),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        InvalidStateError,
      );
      expect(ledger.createEntryTx).not.toHaveBeenCalled();
    });

    it("should reject quote already used by another order", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote({
        status: "used",
        usedByRef: "order:other-order:fx",
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: vi.fn(),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        InvalidStateError,
      );
      expect(ledger.createEntryTx).not.toHaveBeenCalled();
    });

    it("should allow idempotent retries when quote is already used by same order", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote({
        status: "used",
        usedByRef: `order:${ORDER_ID}:fx`,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: updateSequence([[{ id: ORDER_ID }]]),
        };
        return fn(tx);
      });

      const result = await service.executeFx(validInput);
      expect(result).toBe("test-entry-id");
    });

    it("should allow idempotent retry when quote update races but latest matches", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();
      const latest = {
        id: quote.id,
        status: "used",
        usedByRef: `order:${ORDER_ID}:fx`,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote], [latest]]),
          update: updateSequence([
            [], // quote update fails due to race
            [{ id: ORDER_ID }],
          ]),
        };
        return fn(tx);
      });

      const result = await service.executeFx(validInput);
      expect(result).toBe("test-entry-id");
    });

    it("should throw when quote update races and latest does not match", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();
      const latest = {
        id: quote.id,
        status: "used",
        usedByRef: "order:other-order:fx",
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote], [latest]]),
          update: updateSequence([
            [], // quote update fails due to race
          ]),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should be idempotent when CAS fails but order already has our entry", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();

      const current = {
        status: "fx_executed_pending_posting",
        ledgerOperationId: "test-entry-id",
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote], [], [], [current]]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
            [],
          ]),
        };
        return fn(tx);
      });

      const result = await service.executeFx(validInput);
      expect(result).toBe("test-entry-id");
    });

    it("should throw InvalidStateError when CAS fails and order has different entry", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();

      const current = {
        status: "fx_executed",
        ledgerEntryId: "different-entry-id",
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote], [], [], [current]]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
            [],
          ]),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should create fee transfer from persisted quote fee components", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();
      const quoteFeeComponent = {
        quoteId: quote.id,
        idx: 1,
        ruleId: null,
        kind: "fx_fee",
        currencyId: "cur-usd",
        amountMinor: 500n,
        source: "rule",
        settlementMode: "in_ledger",
        debitAccountKey: null,
        creditAccountKey: null,
        transferCode: null,
        memo: null,
        metadata: null,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote], [], [quoteFeeComponent]]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
            [{ id: ORDER_ID }],
          ]),
        };
        return fn(tx);
      });

      await service.executeFx(validInput);

      const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
      const transfers = createEntryCall![1].transfers;

      const feeTransfer = transfers.find((t: any) => t.memo === "Fee revenue");
      expect(feeTransfer).toBeDefined();
      expect(feeTransfer.amount).toBe(500n);
    });

    it("should skip fee transfer when no quote/manual in-ledger fees are present", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
            [{ id: ORDER_ID }],
          ]),
        };
        return fn(tx);
      });

      await service.executeFx(validInput);

      const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
      const transfers = createEntryCall![1].transfers;

      const feeTransfer = transfers.find((t: any) => t.memo === "Fee revenue");
      expect(feeTransfer).toBeUndefined();
    });

    it("should create manual bank fee transfer in arbitrary currency", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
            [{ id: ORDER_ID }],
          ]),
        };
        return fn(tx);
      });

      await service.executeFx({
        ...validInput,
        fees: [
          {
            kind: "bank_fee",
            currency: "EUR",
            amountMinor: 321n,
            memo: "Bank fee revenue",
          },
        ],
      });

      const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
      const transfers = createEntryCall![1].transfers;

      const manualBankFee = transfers.find(
        (t: any) => t.memo === "Bank fee revenue",
      );
      expect(manualBankFee).toBeDefined();
      expect(manualBankFee.currency).toBe("EUR");
      expect(manualBankFee.amount).toBe(321n);
    });

    it("should reserve separate-payment-order fees into clearing account", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
            [{ id: ORDER_ID }],
          ]),
          insert: insertNoop(),
        };
        return fn(tx);
      });

      await service.executeFx({
        ...validInput,
        fees: [
          {
            kind: "bank_fee",
            currency: "USD",
            amountMinor: 77n,
            settlementMode: "separate_payment_order",
          },
        ],
      });

      const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
      const transfers = createEntryCall![1].transfers;

      const reserveTransfer = transfers.find(
        (t: any) => t.memo === "Fee reserved for separate payment order",
      );
      expect(reserveTransfer).toBeDefined();
      expect(reserveTransfer.amount).toBe(77n);
      expect(reserveTransfer.creditAccountNo).toBe(ACCOUNT_NO.FEE_CLEARING);
    });

    it.each([
      {
        label: "first leg fromCurrency mismatch",
        legs: [
          {
            idx: 1,
            fromCurrency: "GBP",
            toCurrency: "EUR",
            fromAmountMinor: 100000n,
            toAmountMinor: 85000n,
          },
        ],
        error: CurrencyMismatchError,
      },
      {
        label: "last leg toCurrency mismatch",
        legs: [
          {
            idx: 1,
            fromCurrency: "USD",
            toCurrency: "GBP",
            fromAmountMinor: 100000n,
            toAmountMinor: 85000n,
          },
        ],
        error: CurrencyMismatchError,
      },
      {
        label: "first leg fromAmountMinor mismatch",
        legs: [
          {
            idx: 1,
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 99999n,
            toAmountMinor: 85000n,
          },
        ],
        error: AmountMismatchError,
      },
      {
        label: "last leg toAmountMinor mismatch",
        legs: [
          {
            idx: 1,
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 100000n,
            toAmountMinor: 84999n,
          },
        ],
        error: AmountMismatchError,
      },
    ])("should reject persisted route with $label", async ({ legs, error }) => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();
      const persistedLegs = legs.map((leg) => ({
        id: `leg-${leg.idx}`,
        quoteId: quote.id,
        fromCurrencyId: currencyIdFromCode(leg.fromCurrency),
        toCurrencyId: currencyIdFromCode(leg.toCurrency),
        rateNum: 1n,
        rateDen: 1n,
        sourceKind: "manual",
        sourceRef: null,
        asOf: validInput.occurredAt,
        executionCounterpartyId: null,
        createdAt: validInput.occurredAt,
        ...leg,
      }));

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote], persistedLegs]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
          ]),
        };
        return fn(tx);
      });

      await expect(service.executeFx(validInput)).rejects.toThrow(error);
    });

    it("should honor custom debit/credit accounts for in-ledger and reserved fee components", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();
      const reserveInsertValues = vi.fn(() => ({
        onConflictDoNothing: vi.fn(async () => []),
      }));
      const reserveInsert = vi.fn(() => ({
        values: reserveInsertValues,
      }));

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
            [{ id: ORDER_ID }],
          ]),
          insert: reserveInsert,
        };
        return fn(tx);
      });

      await service.executeFx({
        ...validInput,
        fees: [
          {
            id: "manual-in-ledger",
            kind: "manual_fee",
            currency: "USD",
            amountMinor: 11n,
            debitAccountKey: "Account:manual:fee:debit",
            creditAccountKey: "Account:manual:fee:credit",
            transferCode: 501,
            memo: "Custom in-ledger fee",
          },
          {
            id: "manual-reserve",
            kind: "bank_fee",
            currency: "USD",
            amountMinor: 12n,
            settlementMode: "separate_payment_order",
            debitAccountKey: "Account:manual:reserve:debit",
            creditAccountKey: "Account:manual:reserve:credit",
            memo: "Custom reserve fee",
          },
        ],
      });

      const transfers = vi.mocked(ledger.createEntryTx).mock.calls[0]![1]
        .transfers;
      const customInLedger = transfers.find(
        (t: any) => t.memo === "Custom in-ledger fee",
      );
      const customReserve = transfers.find(
        (t: any) => t.memo === "Custom reserve fee",
      );
      expect(customInLedger).toBeDefined();
      expect(customInLedger.debitAccountNo).toBe(ACCOUNT_NO.CUSTOMER_WALLET);
      expect(customInLedger.creditAccountNo).toBe(ACCOUNT_NO.FEE_REVENUE);
      expect(customReserve).toBeDefined();
      expect(customReserve.debitAccountNo).toBe(ACCOUNT_NO.CUSTOMER_WALLET);
      expect(customReserve.creditAccountNo).toBe(ACCOUNT_NO.FEE_CLEARING);
      expect(reserveInsertValues).toHaveBeenCalled();
    });

    it("should post manual adjustments and reserve separate adjustment payment orders", async () => {
      const order = createMockOrder({
        status: "funding_settled",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });
      const quote = createFxQuote();
      const reserveInsertValues = vi.fn(() => ({
        onConflictDoNothing: vi.fn(async () => []),
      }));
      const reserveInsert = vi.fn(() => ({
        values: reserveInsertValues,
      }));

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: selectSequence([[order], [quote]]),
          update: updateSequence([
            [
              {
                id: quote.id,
                status: "used",
                usedByRef: `order:${ORDER_ID}:fx`,
              },
            ],
            [{ id: ORDER_ID }],
          ]),
          insert: reserveInsert,
        };
        return fn(tx);
      });

      await service.executeFx({
        ...validInput,
        adjustments: [
          {
            id: "adj-increase",
            kind: "service_adjustment",
            effect: "increase_charge",
            currency: "USD",
            amountMinor: 5n,
          },
          {
            id: "adj-decrease",
            kind: "service_adjustment",
            effect: "decrease_charge",
            currency: "USD",
            amountMinor: 6n,
          },
          {
            id: "adj-custom-in-ledger",
            kind: "custom_adjustment",
            effect: "increase_charge",
            currency: "USD",
            amountMinor: 7n,
            debitAccountKey: "Account:adjustment:custom:debit",
            creditAccountKey: "Account:adjustment:custom:credit",
            memo: "Custom adjustment in-ledger",
          },
          {
            id: "adj-separate-increase",
            kind: "external_adjustment",
            effect: "increase_charge",
            currency: "USD",
            amountMinor: 8n,
            settlementMode: "separate_payment_order",
          },
          {
            id: "adj-separate-decrease",
            kind: "external_adjustment",
            effect: "decrease_charge",
            currency: "USD",
            amountMinor: 9n,
            settlementMode: "separate_payment_order",
          },
          {
            id: "adj-separate-custom",
            kind: "external_adjustment_custom",
            effect: "increase_charge",
            currency: "USD",
            amountMinor: 10n,
            settlementMode: "separate_payment_order",
            debitAccountKey: "Account:adjustment:reserve:debit",
            creditAccountKey: "Account:adjustment:reserve:credit",
            memo: "Custom adjustment reserve",
          },
        ],
      });

      const transfers = vi.mocked(ledger.createEntryTx).mock.calls[0]![1]
        .transfers;
      const increaseTransfer = transfers.find(
        (t: any) => t.memo === "Adjustment charge" && t.amount === 5n,
      );
      const decreaseTransfer = transfers.find(
        (t: any) => t.memo === "Adjustment refund" && t.amount === 6n,
      );
      const customInLedger = transfers.find(
        (t: any) => t.memo === "Custom adjustment in-ledger",
      );
      const reserveIncrease = transfers.find(
        (t: any) =>
          t.memo === "Adjustment reserved for separate payment order" &&
          t.amount === 8n,
      );
      const reserveDecrease = transfers.find(
        (t: any) =>
          t.memo === "Adjustment reserved for separate payment order" &&
          t.amount === 9n,
      );
      const reserveCustom = transfers.find(
        (t: any) => t.memo === "Custom adjustment reserve",
      );

      expect(increaseTransfer).toBeDefined();
      expect(decreaseTransfer).toBeDefined();
      expect(customInLedger).toBeDefined();
      expect(customInLedger.debitAccountNo).toBe(ACCOUNT_NO.CUSTOMER_WALLET);
      expect(customInLedger.creditAccountNo).toBe(
        ACCOUNT_NO.ADJUSTMENT_REVENUE,
      );
      expect(reserveIncrease).toBeDefined();
      expect(reserveIncrease.creditAccountNo).toBe(ACCOUNT_NO.FEE_CLEARING);
      expect(reserveDecrease).toBeDefined();
      expect(reserveDecrease.debitAccountNo).toBe(
        ACCOUNT_NO.ADJUSTMENT_EXPENSE,
      );
      expect(reserveCustom).toBeDefined();
      expect(reserveCustom.debitAccountNo).toBe(ACCOUNT_NO.CUSTOMER_WALLET);
      expect(reserveCustom.creditAccountNo).toBe(ACCOUNT_NO.FEE_CLEARING);

      const insertedFeeOrders = reserveInsertValues.mock.calls[0]![0] as any[];
      expect(insertedFeeOrders).toHaveLength(3);
      expect(insertedFeeOrders.map((row) => row.kind)).toContain(
        "adjustment:external_adjustment",
      );
    });
  });

  describe("initiatePayout", () => {
    const validInput = {
      orderId: ORDER_ID,
      payoutCounterpartyId: BRANCH_COUNTERPARTY_ID,
      payoutBankStableKey: "bank-key-456",
      payOutCurrency: "EUR",
      amountMinor: 85000n,
      railRef: "payout-rail-ref",
      occurredAt: new Date(),
    };

    it("should initiate payout successfully", async () => {
      const order = createMockOrder({
        status: "fx_executed",
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn(async () => [{ id: ORDER_ID }]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      const result = await service.initiatePayout(validInput);

      expect(result.entryId).toBe("test-entry-id");
      expect(result.pendingTransferId).toBeDefined();
      expect(ledger.createEntryTx).toHaveBeenCalled();
    });

    it("should be idempotent if CAS update fails but order already advanced to our entry", async () => {
      const order = createMockOrder({
        status: "fx_executed",
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });

      const current = createMockOrder({
        status: "payout_initiated_pending_posting",
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
        ledgerEntryId: "test-entry-id",
        payoutPendingTransferId: 12345678901234567890n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi
            .fn()
            .mockImplementationOnce(() => selectReturning([order]))
            .mockImplementationOnce(() => selectReturning([current])),
          update: vi.fn(() => updateReturning([])), // CAS failure
        };
        return fn(tx);
      });

      const result = await service.initiatePayout(validInput);
      expect(result).toEqual({
        entryId: "test-entry-id",
        pendingTransferId: 12345678901234567890n,
      });
    });

    it("should throw InvalidStateError if CAS update fails and order did not advance to our entry", async () => {
      const order = createMockOrder({
        status: "fx_executed",
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });

      const current = createMockOrder({
        status: "payout_initiated_pending_posting",
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
        ledgerEntryId: "different-entry-id",
        payoutPendingTransferId: 12345678901234567890n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi
            .fn()
            .mockImplementationOnce(() => selectReturning([order]))
            .mockImplementationOnce(() => selectReturning([current])),
          update: vi.fn(() => updateReturning([])), // CAS failure
        };
        return fn(tx);
      });

      await expect(service.initiatePayout(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should throw InvalidStateError when order is not fx_executed", async () => {
      const order = createMockOrder({
        status: "funding_settled", // Wrong state
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.initiatePayout(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should throw CurrencyMismatchError when payOutCurrency doesn't match", async () => {
      const order = createMockOrder({
        status: "fx_executed",
        payOutCurrency: "GBP", // Different from input EUR
        payOutAmountMinor: 85000n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([order])),
        };
        return fn(tx);
      });

      await expect(service.initiatePayout(validInput)).rejects.toThrow(
        CurrencyMismatchError,
      );
    });

    it("should throw AmountMismatchError when amountMinor doesn't match", async () => {
      const order = createMockOrder({
        status: "fx_executed",
        payOutCurrency: "EUR",
        payOutAmountMinor: 42000n, // Different from input 85000n
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([order])),
        };
        return fn(tx);
      });

      await expect(service.initiatePayout(validInput)).rejects.toThrow(
        AmountMismatchError,
      );
    });

    it("should throw ValidationError when payoutCounterpartyId doesn't match order", async () => {
      const order = createMockOrder({
        status: "fx_executed",
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
        payOutCounterpartyId: "550e8400-e29b-41d4-a716-446655440099",
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([order])),
        };
        return fn(tx);
      });

      await expect(service.initiatePayout(validInput)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw InvalidStateError when idempotent retry but payoutPendingTransferId missing", async () => {
      const order = createMockOrder({
        status: "fx_executed",
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });

      const current = createMockOrder({
        status: "payout_initiated_pending_posting",
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
        ledgerEntryId: "test-entry-id",
        payoutPendingTransferId: null, // Missing!
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi
            .fn()
            .mockImplementationOnce(() => selectReturning([order]))
            .mockImplementationOnce(() => selectReturning([current])),
          update: vi.fn(() => updateReturning([])), // CAS failure
        };
        return fn(tx);
      });

      await expect(service.initiatePayout(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should use custom timeoutSeconds when provided", async () => {
      const order = createMockOrder({
        status: "fx_executed",
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn(async () => [{ id: ORDER_ID }]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await service.initiatePayout({ ...validInput, timeoutSeconds: 3600 });

      const createEntryCall = vi.mocked(ledger.createEntryTx).mock.calls[0];
      const transfer = createEntryCall![1].transfers[0];

      expect(transfer.pending.timeoutSeconds).toBe(3600);
    });
  });

  describe("settlePayout", () => {
    const validInput = {
      orderId: ORDER_ID,
      payOutCurrency: "EUR",
      railRef: "settle-rail-ref",
      occurredAt: new Date(),
    };

    it("should settle payout successfully", async () => {
      const order = createMockOrder({
        status: "payout_initiated",
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn(async () => [{ id: ORDER_ID }]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      const result = await service.settlePayout(validInput);

      expect(result).toBe("test-entry-id");
      expect(ledger.createEntryTx).toHaveBeenCalled();
    });

    it("should be idempotent if CAS update fails but order already advanced to our entry", async () => {
      const order = createMockOrder({
        status: "payout_initiated",
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
      });

      const current = createMockOrder({
        status: "closed_pending_posting",
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
        ledgerEntryId: "test-entry-id",
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi
            .fn()
            .mockImplementationOnce(() => selectReturning([order]))
            .mockImplementationOnce(() => selectReturning([current])),
          update: vi.fn(() => updateReturning([])), // CAS failure
        };
        return fn(tx);
      });

      const result = await service.settlePayout(validInput);
      expect(result).toBe("test-entry-id");
    });

    it("should throw InvalidStateError if CAS update fails and order did not advance to our entry", async () => {
      const order = createMockOrder({
        status: "payout_initiated",
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
      });

      const current = createMockOrder({
        status: "closed_pending_posting",
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
        ledgerEntryId: "different-entry-id",
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi
            .fn()
            .mockImplementationOnce(() => selectReturning([order]))
            .mockImplementationOnce(() => selectReturning([current])),
          update: vi.fn(() => updateReturning([])), // CAS failure
        };
        return fn(tx);
      });

      await expect(service.settlePayout(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should throw InvalidStateError when order is not payout_initiated", async () => {
      const order = createMockOrder({
        status: "fx_executed", // Wrong state
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.settlePayout(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should throw CurrencyMismatchError when payOutCurrency doesn't match", async () => {
      const order = createMockOrder({
        status: "payout_initiated",
        payOutCurrency: "GBP", // Different from input EUR
        payoutPendingTransferId: 12345n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([order])),
        };
        return fn(tx);
      });

      await expect(service.settlePayout(validInput)).rejects.toThrow(
        CurrencyMismatchError,
      );
    });

    it("should throw InvalidStateError when payoutPendingTransferId is missing", async () => {
      const order = createMockOrder({
        status: "payout_initiated",
        payOutCurrency: "EUR",
        payoutPendingTransferId: null, // Missing
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.settlePayout(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });
  });

  describe("voidPayout", () => {
    const validInput = {
      orderId: ORDER_ID,
      payOutCurrency: "EUR",
      railRef: "void-rail-ref",
      occurredAt: new Date(),
    };

    it("should void payout successfully", async () => {
      const order = createMockOrder({
        status: "payout_initiated",
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn(async () => [{ id: ORDER_ID }]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      const result = await service.voidPayout(validInput);

      expect(result).toBe("test-entry-id");
      expect(ledger.createEntryTx).toHaveBeenCalled();
    });

    it("should be idempotent if CAS update fails but order already advanced to our entry", async () => {
      const order = createMockOrder({
        status: "payout_initiated",
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
      });

      const current = createMockOrder({
        status: "failed_pending_posting",
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
        ledgerEntryId: "test-entry-id",
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi
            .fn()
            .mockImplementationOnce(() => selectReturning([order]))
            .mockImplementationOnce(() => selectReturning([current])),
          update: vi.fn(() => updateReturning([])), // CAS failure
        };
        return fn(tx);
      });

      const result = await service.voidPayout(validInput);
      expect(result).toBe("test-entry-id");
    });

    it("should throw InvalidStateError if CAS update fails and order did not advance to our entry", async () => {
      const order = createMockOrder({
        status: "payout_initiated",
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
      });

      const current = createMockOrder({
        status: "failed_pending_posting",
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
        ledgerEntryId: "different-entry-id",
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi
            .fn()
            .mockImplementationOnce(() => selectReturning([order]))
            .mockImplementationOnce(() => selectReturning([current])),
          update: vi.fn(() => updateReturning([])), // CAS failure
        };
        return fn(tx);
      });

      await expect(service.voidPayout(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should throw InvalidStateError when order is not payout_initiated", async () => {
      const order = createMockOrder({
        status: "closed", // Wrong state
        payOutCurrency: "EUR",
        payoutPendingTransferId: 12345n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [order]),
              })),
            })),
          })),
        };
        return fn(tx);
      });

      await expect(service.voidPayout(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should throw CurrencyMismatchError when payOutCurrency doesn't match", async () => {
      const order = createMockOrder({
        status: "payout_initiated",
        payOutCurrency: "GBP", // Different from input EUR
        payoutPendingTransferId: 12345n,
      });

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([order])),
        };
        return fn(tx);
      });

      await expect(service.voidPayout(validInput)).rejects.toThrow(
        CurrencyMismatchError,
      );
    });
  });

  describe("initiateFeePayment", () => {
    const feePaymentOrderId = "550e8400-e29b-41d4-a716-446655440033";
    const validInput = {
      feePaymentOrderId,
      payoutCounterpartyId: BRANCH_COUNTERPARTY_ID,
      payoutOperationalAccountId: BANK_ACCOUNT_ID,
      railRef: "fee-init-rail-ref",
      occurredAt: new Date(),
    };

    it("should initiate fee payment successfully", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "reserved",
        bucket: "bank",
        kind: "bank_fee",
        currencyId: "cur-usd",
        amountMinor: 77n,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
          update: vi.fn(() => updateReturning([{ id: feePaymentOrderId }])),
        };
        return fn(tx);
      });

      const result = await service.initiateFeePayment(validInput);
      expect(result).toEqual({
        entryId: "test-entry-id",
        pendingTransferId: 12345678901234567890n,
      });
    });

    it("should reject non-reserved fee payment order", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "initiated",
        bucket: "bank",
        kind: "bank_fee",
        currencyId: "cur-usd",
        amountMinor: 77n,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      await expect(service.initiateFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should allow idempotent retry when fee payment is already initiated with same parameters", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "initiated",
        bucket: "bank",
        kind: "bank_fee",
        currencyId: "cur-usd",
        amountMinor: 77n,
        railRef: "fee-init-rail-ref",
        payoutCounterpartyId: BRANCH_COUNTERPARTY_ID,
        payoutOperationalAccountId: BANK_ACCOUNT_ID,
        initiateOperationId: "test-entry-id",
        pendingTransferId: 12345678901234567890n,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      const result = await service.initiateFeePayment(validInput);
      expect(result).toEqual({
        entryId: "test-entry-id",
        pendingTransferId: 12345678901234567890n,
      });
      expect(ledger.createEntryTx).not.toHaveBeenCalled();
    });

    it("should reject idempotent replay when railRef differs", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "initiated",
        bucket: "bank",
        kind: "bank_fee",
        currencyId: "cur-usd",
        amountMinor: 77n,
        railRef: "different-rail-ref",
        payoutCounterpartyId: BRANCH_COUNTERPARTY_ID,
        payoutOperationalAccountId: BANK_ACCOUNT_ID,
        initiateOperationId: "test-entry-id",
        pendingTransferId: 12345678901234567890n,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      await expect(service.initiateFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should reject idempotent replay when initiated entry identifiers are missing", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "initiated",
        bucket: "bank",
        kind: "bank_fee",
        currencyId: "cur-usd",
        amountMinor: 77n,
        railRef: validInput.railRef,
        payoutCounterpartyId: BRANCH_COUNTERPARTY_ID,
        payoutOperationalAccountId: BANK_ACCOUNT_ID,
        initiateOperationId: null,
        pendingTransferId: null,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      await expect(service.initiateFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should reject CAS fallback when pendingTransferId is missing", async () => {
      const reserved = {
        id: feePaymentOrderId,
        status: "reserved",
        bucket: "bank",
        kind: "bank_fee",
        currencyId: "cur-usd",
        amountMinor: 77n,
      };
      const current = {
        id: feePaymentOrderId,
        status: "initiated_pending_posting",
        initiateEntryId: "test-entry-id",
        pendingTransferId: null,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi
            .fn()
            .mockImplementationOnce(() => selectReturning([reserved]))
            .mockImplementationOnce(() => selectReturning([current])),
          update: vi.fn(() => updateReturning([])),
        };
        return fn(tx);
      });

      await expect(service.initiateFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });
  });

  describe("settleFeePayment", () => {
    const feePaymentOrderId = "550e8400-e29b-41d4-a716-446655440034";
    const validInput = {
      feePaymentOrderId,
      railRef: "fee-settle-rail-ref",
      occurredAt: new Date(),
    };

    it("should settle fee payment successfully", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "initiated",
        currencyId: "cur-usd",
        pendingTransferId: 42n,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
          update: vi.fn(() => updateReturning([{ id: feePaymentOrderId }])),
        };
        return fn(tx);
      });

      const result = await service.settleFeePayment(validInput);
      expect(result).toBe("test-entry-id");
    });

    it("should allow idempotent retry when fee payment is already settled", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "settled",
        currencyId: "cur-usd",
        railRef: "fee-settle-rail-ref",
        resolveOperationId: "settled-entry-id",
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      const result = await service.settleFeePayment(validInput);
      expect(result).toBe("settled-entry-id");
      expect(ledger.createEntryTx).not.toHaveBeenCalled();
    });

    it("should reject settle when initiated order has no pendingTransferId", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "initiated",
        currencyId: "cur-usd",
        pendingTransferId: null,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      await expect(service.settleFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should reject settled replay when railRef differs", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "settled",
        currencyId: "cur-usd",
        railRef: "other-rail-ref",
        resolveEntryId: "settled-entry-id",
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      await expect(service.settleFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should reject settled replay when resolveEntryId is missing", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "settled",
        currencyId: "cur-usd",
        railRef: validInput.railRef,
        resolveOperationId: null,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      await expect(service.settleFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should reject settle CAS fallback when latest state does not match created entry", async () => {
      const initiated = {
        id: feePaymentOrderId,
        status: "initiated",
        currencyId: "cur-usd",
        pendingTransferId: 42n,
      };
      const current = {
        id: feePaymentOrderId,
        status: "settled_pending_posting",
        resolveEntryId: "another-entry",
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi
            .fn()
            .mockImplementationOnce(() => selectReturning([initiated]))
            .mockImplementationOnce(() => selectReturning([current])),
          update: vi.fn(() => updateReturning([])),
        };
        return fn(tx);
      });

      await expect(service.settleFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });
  });

  describe("voidFeePayment", () => {
    const feePaymentOrderId = "550e8400-e29b-41d4-a716-446655440035";
    const validInput = {
      feePaymentOrderId,
      railRef: "fee-void-rail-ref",
      occurredAt: new Date(),
    };

    it("should void fee payment successfully", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "initiated",
        currencyId: "cur-usd",
        pendingTransferId: 42n,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
          update: vi.fn(() => updateReturning([{ id: feePaymentOrderId }])),
        };
        return fn(tx);
      });

      const result = await service.voidFeePayment(validInput);
      expect(result).toBe("test-entry-id");
    });

    it("should allow idempotent retry when fee payment is already voided", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "voided",
        currencyId: "cur-usd",
        railRef: "fee-void-rail-ref",
        resolveOperationId: "voided-entry-id",
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      const result = await service.voidFeePayment(validInput);
      expect(result).toBe("voided-entry-id");
      expect(ledger.createEntryTx).not.toHaveBeenCalled();
    });

    it("should reject void when initiated order has no pendingTransferId", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "initiated",
        currencyId: "cur-usd",
        pendingTransferId: null,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      await expect(service.voidFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should reject voided replay when railRef differs", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "voided",
        currencyId: "cur-usd",
        railRef: "other-rail-ref",
        resolveOperationId: "voided-entry-id",
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      await expect(service.voidFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should reject voided replay when resolveEntryId is missing", async () => {
      const feeOrder = {
        id: feePaymentOrderId,
        status: "voided",
        currencyId: "cur-usd",
        railRef: validInput.railRef,
        resolveOperationId: null,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => selectReturning([feeOrder])),
        };
        return fn(tx);
      });

      await expect(service.voidFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });

    it("should reject void CAS fallback when latest state does not match created entry", async () => {
      const initiated = {
        id: feePaymentOrderId,
        status: "initiated",
        currencyId: "cur-usd",
        pendingTransferId: 42n,
      };
      const current = {
        id: feePaymentOrderId,
        status: "voided_pending_posting",
        resolveEntryId: "another-entry",
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi
            .fn()
            .mockImplementationOnce(() => selectReturning([initiated]))
            .mockImplementationOnce(() => selectReturning([current])),
          update: vi.fn(() => updateReturning([])),
        };
        return fn(tx);
      });

      await expect(service.voidFeePayment(validInput)).rejects.toThrow(
        InvalidStateError,
      );
    });
  });
});
