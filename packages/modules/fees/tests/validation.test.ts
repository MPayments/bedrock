import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  validateFeeComponent,
  validateFxQuoteFeeCalculation,
  validateGetQuoteFeeComponentsInput,
  validateInput,
  validateResolveFeeRulesInput,
  validateSaveQuoteFeeComponentsInput,
  validateUpsertFeeRuleInput,
} from "../src/application/validation";
import * as feesContracts from "../src/contracts";
import { FeeValidationError, FeesError } from "../src/errors";
import * as feesApi from "../src/index";

const VALID_QUOTE_ID = "11111111-1111-4111-8111-111111111111";

describe("fees validation", () => {
  it("normalizes fee components and strips unsupported custom account keys", () => {
    const normalized = validateFeeComponent({
      id: "c1",
      kind: "fx_fee",
      currency: "usd",
      amountMinor: 12n,
      source: "rule",
    });

    expect(normalized.currency).toBe("USD");

    const custom = validateFeeComponent({
      id: "c2",
      kind: "fx_fee",
      currency: "USD",
      amountMinor: 5n,
      source: "rule",
      debitAccountKey: "Account:debit",
    } as any);
    expect((custom as any).debitAccountKey).toBeUndefined();
  });

  it("validates fee-rule shape constraints and normalizes fixed currency", () => {
    expect(() =>
      validateUpsertFeeRuleInput({
        name: "Invalid mixed rule",
        operationKind: "fx_quote",
        feeKind: "fx_fee",
        calcMethod: "bps",
        bps: 25,
        fixedAmountMinor: 100n,
      }),
    ).toThrowError(/calcMethod=bps requires bps and forbids fixedAmountMinor/);

    expect(() =>
      validateUpsertFeeRuleInput({
        name: "Invalid fixed rule",
        operationKind: "fx_quote",
        feeKind: "fx_fee",
        calcMethod: "fixed",
      }),
    ).toThrowError(/calcMethod=bps requires bps and forbids fixedAmountMinor/);

    const from = new Date("2026-02-14T10:00:00Z");
    const to = new Date("2026-02-14T10:00:00Z");
    expect(() =>
      validateUpsertFeeRuleInput({
        name: "Invalid effective window",
        operationKind: "fx_quote",
        feeKind: "fx_fee",
        calcMethod: "fixed",
        fixedAmountMinor: 10n,
        effectiveFrom: from,
        effectiveTo: to,
      }),
    ).toThrowError(/effectiveTo must be later than effectiveFrom/);

    const fixed = validateUpsertFeeRuleInput({
      name: "Fixed fee rule",
      operationKind: "fx_quote",
      feeKind: "bank_fee",
      calcMethod: "fixed",
      fixedAmountMinor: 100n,
      fixedCurrency: "eur",
    });
    expect(fixed.fixedCurrency).toBe("EUR");
  });

  it("rejects invalid inputs for quote-fee and quote-component APIs", () => {
    expect(() =>
      validateFxQuoteFeeCalculation({
        fromCurrency: "USD",
        toCurrency: "EUR",
        principalMinor: 0n,
        at: new Date(),
      }),
    ).toThrowError(/Amount must be positive/);

    expect(() =>
      validateSaveQuoteFeeComponentsInput({
        quoteId: "not-a-uuid",
        components: [],
      }),
    ).toThrowError(/saveQuoteFeeComponents:/);

    expect(() =>
      validateGetQuoteFeeComponentsInput({
        quoteId: "not-a-uuid",
      }),
    ).toThrowError(/getQuoteFeeComponents:/);
  });

  it("validates rule-resolution input and formats contextual validation errors", () => {
    const validated = validateResolveFeeRulesInput({
      operationKind: "fx_quote",
      at: new Date("2026-02-14T00:00:00Z"),
      fromCurrency: "usd",
      toCurrency: "eur",
      dealDirection: "cash_to_wire",
      dealForm: "conversion",
    });

    expect(validated.fromCurrency).toBe("USD");
    expect(validated.toCurrency).toBe("EUR");

    expect(() =>
      validateInput(z.string().min(3), "x", "customContext"),
    ).toThrowError(/^customContext:/);
  });

  it("keeps error hierarchy and public API exports stable", () => {
    const rootCause = new Error("cause");
    const root = new FeesError("fees exploded", rootCause);
    const validation = new FeeValidationError("bad input");

    expect(root).toBeInstanceOf(Error);
    expect(root.cause).toBe(rootCause);
    expect(validation).toBeInstanceOf(FeesError);
    expect(validation.name).toBe("FeeValidationError");

    expect(typeof feesApi.createFeesService).toBe("function");
    expect(feesApi.FeeValidationError).toBe(FeeValidationError);
    expect("feeCalcMethodSchema" in feesApi).toBe(false);
    expect(feesContracts.feeCalcMethodSchema.parse("bps")).toBe("bps");

    const validPayload = feesContracts.getQuoteFeeComponentsSchema.parse({
      quoteId: VALID_QUOTE_ID,
    });
    expect(validPayload.quoteId).toBe(VALID_QUOTE_ID);
  });
});
