import { describe, it, expect } from "vitest";
import {
    validateFundingSettledInput,
    validateExecuteFxInput,
    validateInitiatePayoutInput,
    validateSettlePayoutInput,
    validateVoidPayoutInput,
    validateInput,
} from "../src/validation";
import { ValidationError } from "../src/errors";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("fundingSettledInputSchema", () => {
    const validInput = {
        orderId: validUuid,
        branchOrgId: validUuid,
        branchBankStableKey: "bank-key-123",
        customerId: validUuid,
        currency: "USD",
        amountMinor: 100000n,
        railRef: "rail-ref-123",
        occurredAt: new Date(),
    };

    it("should validate correct input", () => {
        expect(() => validateFundingSettledInput(validInput)).not.toThrow();
    });

    it("should normalize currency to uppercase", () => {
        const result = validateFundingSettledInput({ ...validInput, currency: "usd" });
        expect(result.currency).toBe("USD");
    });

    it("should reject invalid UUID for orderId", () => {
        expect(() => validateFundingSettledInput({ ...validInput, orderId: "not-a-uuid" }))
            .toThrow(ValidationError);
    });

    it("should reject empty branchBankStableKey", () => {
        expect(() => validateFundingSettledInput({ ...validInput, branchBankStableKey: "" }))
            .toThrow(ValidationError);
    });

    it("should reject zero amount", () => {
        expect(() => validateFundingSettledInput({ ...validInput, amountMinor: 0n }))
            .toThrow(ValidationError);
    });

    it("should reject negative amount", () => {
        expect(() => validateFundingSettledInput({ ...validInput, amountMinor: -100n }))
            .toThrow(ValidationError);
    });

    it("should reject empty railRef", () => {
        expect(() => validateFundingSettledInput({ ...validInput, railRef: "" }))
            .toThrow(ValidationError);
    });

    it("should reject invalid currency format", () => {
        expect(() => validateFundingSettledInput({ ...validInput, currency: "U" }))
            .toThrow(ValidationError);
    });
});

describe("executeFxInputSchema", () => {
    const validInput = {
        orderId: validUuid,
        branchOrgId: validUuid,
        customerId: validUuid,
        payInCurrency: "USD",
        principalMinor: 100000n,
        feeMinor: 500n,
        spreadMinor: 200n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
        occurredAt: new Date(),
        quoteRef: "quote-ref-123",
    };

    it("should validate correct input", () => {
        expect(() => validateExecuteFxInput(validInput)).not.toThrow();
    });

    it("should allow zero fee", () => {
        expect(() => validateExecuteFxInput({ ...validInput, feeMinor: 0n })).not.toThrow();
    });

    it("should allow zero spread", () => {
        expect(() => validateExecuteFxInput({ ...validInput, spreadMinor: 0n })).not.toThrow();
    });

    it("should reject negative fee", () => {
        expect(() => validateExecuteFxInput({ ...validInput, feeMinor: -100n }))
            .toThrow(ValidationError);
    });

    it("should reject negative spread", () => {
        expect(() => validateExecuteFxInput({ ...validInput, spreadMinor: -100n }))
            .toThrow(ValidationError);
    });

    it("should reject zero principal", () => {
        expect(() => validateExecuteFxInput({ ...validInput, principalMinor: 0n }))
            .toThrow(ValidationError);
    });

    it("should reject zero payOutAmount", () => {
        expect(() => validateExecuteFxInput({ ...validInput, payOutAmountMinor: 0n }))
            .toThrow(ValidationError);
    });

    it("should reject empty quoteRef", () => {
        expect(() => validateExecuteFxInput({ ...validInput, quoteRef: "" }))
            .toThrow(ValidationError);
    });
});

describe("initiatePayoutInputSchema", () => {
    const validInput = {
        orderId: validUuid,
        payoutOrgId: validUuid,
        payoutBankStableKey: "bank-key-456",
        payOutCurrency: "EUR",
        amountMinor: 85000n,
        railRef: "payout-rail-ref",
        occurredAt: new Date(),
    };

    it("should validate correct input", () => {
        expect(() => validateInitiatePayoutInput(validInput)).not.toThrow();
    });

    it("should allow optional timeoutSeconds", () => {
        expect(() => validateInitiatePayoutInput({ ...validInput, timeoutSeconds: 3600 })).not.toThrow();
    });

    it("should reject zero timeoutSeconds", () => {
        expect(() => validateInitiatePayoutInput({ ...validInput, timeoutSeconds: 0 }))
            .toThrow(ValidationError);
    });

    it("should reject negative timeoutSeconds", () => {
        expect(() => validateInitiatePayoutInput({ ...validInput, timeoutSeconds: -1 }))
            .toThrow(ValidationError);
    });

    it("should reject zero amount", () => {
        expect(() => validateInitiatePayoutInput({ ...validInput, amountMinor: 0n }))
            .toThrow(ValidationError);
    });

    it("should reject empty payoutBankStableKey", () => {
        expect(() => validateInitiatePayoutInput({ ...validInput, payoutBankStableKey: "" }))
            .toThrow(ValidationError);
    });
});

describe("settlePayoutInputSchema", () => {
    const validInput = {
        orderId: validUuid,
        payOutCurrency: "EUR",
        railRef: "settle-rail-ref",
        occurredAt: new Date(),
    };

    it("should validate correct input", () => {
        expect(() => validateSettlePayoutInput(validInput)).not.toThrow();
    });

    it("should reject invalid orderId", () => {
        expect(() => validateSettlePayoutInput({ ...validInput, orderId: "invalid" }))
            .toThrow(ValidationError);
    });

    it("should reject empty railRef", () => {
        expect(() => validateSettlePayoutInput({ ...validInput, railRef: "" }))
            .toThrow(ValidationError);
    });
});

describe("voidPayoutInputSchema", () => {
    const validInput = {
        orderId: validUuid,
        payOutCurrency: "EUR",
        railRef: "void-rail-ref",
        occurredAt: new Date(),
    };

    it("should validate correct input", () => {
        expect(() => validateVoidPayoutInput(validInput)).not.toThrow();
    });

    it("should reject invalid orderId", () => {
        expect(() => validateVoidPayoutInput({ ...validInput, orderId: "invalid" }))
            .toThrow(ValidationError);
    });

    it("should reject empty railRef", () => {
        expect(() => validateVoidPayoutInput({ ...validInput, railRef: "" }))
            .toThrow(ValidationError);
    });
});

describe("validateInput", () => {
    it("throws when a schema reports no issue details", () => {
        const fakeSchema = {
            safeParse: () => ({
                success: false,
                error: { issues: [], message: "boom" },
            }),
        } as any;

        expect(() => validateInput(fakeSchema, {}, "test")).toThrow(ValidationError);
    });
});

describe("currency normalization", () => {
    it("should uppercase and trim currency in fundingSettled", () => {
        const input = {
            orderId: validUuid,
            branchOrgId: validUuid,
            branchBankStableKey: "bank-key",
            customerId: validUuid,
            currency: "  eur  ",
            amountMinor: 100n,
            railRef: "ref",
            occurredAt: new Date(),
        };
        const result = validateFundingSettledInput(input);
        expect(result.currency).toBe("EUR");
    });

    it("should accept valid currency formats", () => {
        const validCurrencies = ["USD", "EUR", "GBP", "BTC", "ETH", "USDC", "TEST_TOKEN"];
        for (const currency of validCurrencies) {
            const input = {
                orderId: validUuid,
                branchOrgId: validUuid,
                branchBankStableKey: "bank-key",
                customerId: validUuid,
                currency,
                amountMinor: 100n,
                railRef: "ref",
                occurredAt: new Date(),
            };
            expect(() => validateFundingSettledInput(input)).not.toThrow();
        }
    });
});
