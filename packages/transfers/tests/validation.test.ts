import { describe, expect, it } from "vitest";

import { ValidationError } from "../src/errors";
import {
    validateApproveTransferInput,
    validateCreateTransferDraftInput,
    validateSettlePendingTransferInput,
    validateVoidPendingTransferInput,
} from "../src/validation";

describe("transfers validation (v2)", () => {
    it("validates transfer draft input", () => {
        const result = validateCreateTransferDraftInput({
            sourceAccountId: "550e8400-e29b-41d4-a716-446655440001",
            destinationAccountId: "550e8400-e29b-41d4-a716-446655440002",
            idempotencyKey: "draft-key",
            amountMinor: 1000n,
            makerUserId: "550e8400-e29b-41d4-a716-446655440003",
            settlementMode: "pending",
            timeoutSeconds: 3600,
            memo: "test",
        });

        expect(result.settlementMode).toBe("pending");
        expect(result.timeoutSeconds).toBe(3600);
    });

    it("rejects self-transfer draft", () => {
        expect(() =>
            validateCreateTransferDraftInput({
                sourceAccountId: "550e8400-e29b-41d4-a716-446655440001",
                destinationAccountId: "550e8400-e29b-41d4-a716-446655440001",
                idempotencyKey: "draft-key",
                amountMinor: 1000n,
                makerUserId: "550e8400-e29b-41d4-a716-446655440003",
            }),
        ).toThrow(ValidationError);
    });

    it("validates approve input", () => {
        const result = validateApproveTransferInput({
            transferId: "550e8400-e29b-41d4-a716-446655440010",
            checkerUserId: "550e8400-e29b-41d4-a716-446655440011",
            occurredAt: new Date("2026-02-25T00:00:00.000Z"),
        });

        expect(result.transferId).toBe("550e8400-e29b-41d4-a716-446655440010");
    });

    it("validates settle pending input", () => {
        const result = validateSettlePendingTransferInput({
            transferId: "550e8400-e29b-41d4-a716-446655440010",
            eventIdempotencyKey: "settle-1",
            occurredAt: new Date("2026-02-25T00:00:00.000Z"),
            externalRef: "rail-ref-1",
        });

        expect(result.eventIdempotencyKey).toBe("settle-1");
    });

    it("validates void pending input", () => {
        const result = validateVoidPendingTransferInput({
            transferId: "550e8400-e29b-41d4-a716-446655440010",
            eventIdempotencyKey: "void-1",
            occurredAt: new Date("2026-02-25T00:00:00.000Z"),
            reason: "Operator cancelled",
        });

        expect(result.reason).toBe("Operator cancelled");
    });
});
