import { describe, it, expect } from "vitest";
import {
    validateCreateDraftInput,
    validateApproveInput,
    validateRejectInput,
    validateMarkFailedInput,
    validateInput,
} from "../src/validation";
import { ValidationError } from "../src/errors";

describe("Validation", () => {
    describe("validateCreateDraftInput", () => {
        const validInput = {
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            idempotencyKey: "test-key",
            fromAccountKey: "Account:org1:vault:USD",
            toAccountKey: "Account:org1:operating:USD",
            currency: "USD",
            amountMinor: 100000n,
            makerUserId: "550e8400-e29b-41d4-a716-446655440001",
        };

        it("should validate correct input", () => {
            const result = validateCreateDraftInput(validInput);
            expect(result).toMatchObject(validInput);
        });

        it("should normalize currency to uppercase", () => {
            const result = validateCreateDraftInput({
                ...validInput,
                currency: "usd",
            });
            expect(result.currency).toBe("USD");
        });

        it("should throw ValidationError for invalid orgId", () => {
            expect(() =>
                validateCreateDraftInput({
                    ...validInput,
                    orgId: "not-a-uuid",
                })
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError for negative amount", () => {
            expect(() =>
                validateCreateDraftInput({
                    ...validInput,
                    amountMinor: -100n,
                })
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError for zero amount", () => {
            expect(() =>
                validateCreateDraftInput({
                    ...validInput,
                    amountMinor: 0n,
                })
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError for same from and to account", () => {
            expect(() =>
                validateCreateDraftInput({
                    ...validInput,
                    fromAccountKey: "Account:org1:vault:USD",
                    toAccountKey: "Account:org1:vault:USD",
                })
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError for invalid currency", () => {
            expect(() =>
                validateCreateDraftInput({
                    ...validInput,
                    currency: "X",
                })
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError for empty idempotencyKey", () => {
            expect(() =>
                validateCreateDraftInput({
                    ...validInput,
                    idempotencyKey: "",
                })
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError for empty accountKey", () => {
            expect(() =>
                validateCreateDraftInput({
                    ...validInput,
                    fromAccountKey: "",
                })
            ).toThrow(ValidationError);
        });

        it("should accept optional memo", () => {
            const result = validateCreateDraftInput({
                ...validInput,
                memo: "Test memo",
            });
            expect(result.memo).toBe("Test memo");
        });

        it("should throw ValidationError for memo exceeding max length", () => {
            expect(() =>
                validateCreateDraftInput({
                    ...validInput,
                    memo: "x".repeat(1001),
                })
            ).toThrow(ValidationError);
        });
    });

    describe("validateApproveInput", () => {
        const validInput = {
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            transferId: "550e8400-e29b-41d4-a716-446655440001",
            checkerUserId: "550e8400-e29b-41d4-a716-446655440002",
            occurredAt: new Date(),
        };

        it("should validate correct input", () => {
            const result = validateApproveInput(validInput);
            expect(result).toMatchObject(validInput);
        });

        it("should throw ValidationError for invalid transferId", () => {
            expect(() =>
                validateApproveInput({
                    ...validInput,
                    transferId: "not-a-uuid",
                })
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError for invalid checkerUserId", () => {
            expect(() =>
                validateApproveInput({
                    ...validInput,
                    checkerUserId: "not-a-uuid",
                })
            ).toThrow(ValidationError);
        });
    });

    describe("validateRejectInput", () => {
        const validInput = {
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            transferId: "550e8400-e29b-41d4-a716-446655440001",
            checkerUserId: "550e8400-e29b-41d4-a716-446655440002",
            occurredAt: new Date(),
            reason: "Invalid transfer request",
        };

        it("should validate correct input", () => {
            const result = validateRejectInput(validInput);
            expect(result).toMatchObject(validInput);
        });

        it("should throw ValidationError for empty reason", () => {
            expect(() =>
                validateRejectInput({
                    ...validInput,
                    reason: "",
                })
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError for reason exceeding max length", () => {
            expect(() =>
                validateRejectInput({
                    ...validInput,
                    reason: "x".repeat(1001),
                })
            ).toThrow(ValidationError);
        });
    });

    describe("validateMarkFailedInput", () => {
        const validInput = {
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            transferId: "550e8400-e29b-41d4-a716-446655440001",
            reason: "Journal posting failed",
        };

        it("should validate correct input", () => {
            const result = validateMarkFailedInput(validInput);
            expect(result).toMatchObject(validInput);
        });

        it("should throw ValidationError for invalid transferId", () => {
            expect(() =>
                validateMarkFailedInput({
                    ...validInput,
                    transferId: "not-a-uuid",
                })
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError for empty reason", () => {
            expect(() =>
                validateMarkFailedInput({
                    ...validInput,
                    reason: "",
                })
            ).toThrow(ValidationError);
        });
    });

    it("handles schemas that report no issue details", () => {
        const fakeSchema = {
            safeParse: () => ({
                success: false,
                error: { issues: [], message: "boom" },
            }),
        } as any;

        expect(() => validateInput(fakeSchema, {}, "test")).toThrow(ValidationError);
    });
});
