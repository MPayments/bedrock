import { describe, it, expect } from "vitest";
import { AmountMismatchError, CurrencyMismatchError, InvalidStateError, NotFoundError, ServiceError, ValidationError } from "@bedrock/kernel/errors";
import { PaymentsError } from "../src/errors";

describe("PaymentsError", () => {
    it("should be an instance of Error", () => {
        const error = new PaymentsError("test message");
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(PaymentsError);
    });

    it("should have correct name", () => {
        const error = new PaymentsError("test");
        expect(error.name).toBe("PaymentsError");
    });

    it("should have correct message", () => {
        const error = new PaymentsError("test message");
        expect(error.message).toBe("test message");
    });
});

describe("InvalidStateError", () => {
    it("should extend ServiceError", () => {
        const error = new InvalidStateError("invalid state");
        expect(error).toBeInstanceOf(ServiceError);
        expect(error).toBeInstanceOf(InvalidStateError);
    });

    it("should have correct name", () => {
        const error = new InvalidStateError("test");
        expect(error.name).toBe("InvalidStateError");
    });
});

describe("NotFoundError", () => {
    it("should extend ServiceError", () => {
        const error = new NotFoundError("Order", "order-123");
        expect(error).toBeInstanceOf(ServiceError);
        expect(error).toBeInstanceOf(NotFoundError);
    });

    it("should have correct name", () => {
        const error = new NotFoundError("Order", "123");
        expect(error.name).toBe("NotFoundError");
    });

    it("should format message correctly", () => {
        const error = new NotFoundError("Order", "order-123");
        expect(error.message).toBe("Order not found: order-123");
    });

    it("should expose entityType and entityId", () => {
        const error = new NotFoundError("Customer", "cust-456");
        expect(error.entityType).toBe("Customer");
        expect(error.entityId).toBe("cust-456");
    });
});

describe("ValidationError", () => {
    it("should extend ServiceError", () => {
        const error = new ValidationError("validation failed");
        expect(error).toBeInstanceOf(ServiceError);
        expect(error).toBeInstanceOf(ValidationError);
    });

    it("should have correct name", () => {
        const error = new ValidationError("test");
        expect(error.name).toBe("ValidationError");
    });
});

describe("AmountMismatchError", () => {
    it("should extend ValidationError", () => {
        const error = new AmountMismatchError("amount", 100n, 200n);
        expect(error).toBeInstanceOf(ValidationError);
        expect(error).toBeInstanceOf(AmountMismatchError);
    });

    it("should have correct name", () => {
        const error = new AmountMismatchError("amount", 100n, 200n);
        expect(error.name).toBe("AmountMismatchError");
    });

    it("should format message correctly", () => {
        const error = new AmountMismatchError("payInAmount", 100n, 200n);
        expect(error.message).toBe("payInAmount mismatch: expected 100, got 200");
    });

    it("should expose field, expected, and actual", () => {
        const error = new AmountMismatchError("field", 500n, 600n);
        expect(error.field).toBe("field");
        expect(error.expected).toBe(500n);
        expect(error.actual).toBe(600n);
    });
});

describe("CurrencyMismatchError", () => {
    it("should extend ValidationError", () => {
        const error = new CurrencyMismatchError("currency", "USD", "EUR");
        expect(error).toBeInstanceOf(ValidationError);
        expect(error).toBeInstanceOf(CurrencyMismatchError);
    });

    it("should have correct name", () => {
        const error = new CurrencyMismatchError("currency", "USD", "EUR");
        expect(error.name).toBe("CurrencyMismatchError");
    });

    it("should format message correctly", () => {
        const error = new CurrencyMismatchError("payInCurrency", "USD", "EUR");
        expect(error.message).toBe("payInCurrency currency mismatch: expected USD, got EUR");
    });

    it("should expose field, expected, and actual", () => {
        const error = new CurrencyMismatchError("field", "GBP", "JPY");
        expect(error.field).toBe("field");
        expect(error.expected).toBe("GBP");
        expect(error.actual).toBe("JPY");
    });
});

describe("error hierarchy", () => {
    it("should allow catching all service errors", () => {
        const errors = [
            new InvalidStateError("state"),
            new NotFoundError("Order", "123"),
            new ValidationError("validation"),
            new AmountMismatchError("amount", 1n, 2n),
            new CurrencyMismatchError("currency", "USD", "EUR"),
        ];

        for (const error of errors) {
            expect(error).toBeInstanceOf(ServiceError);
        }
    });

    it("should allow catching all validation errors", () => {
        const errors = [
            new ValidationError("validation"),
            new AmountMismatchError("amount", 1n, 2n),
            new CurrencyMismatchError("currency", "USD", "EUR"),
        ];

        for (const error of errors) {
            expect(error).toBeInstanceOf(ValidationError);
        }
    });
});
