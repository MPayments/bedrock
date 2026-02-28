import { describe, expect, it } from "vitest";

import { ValidationError } from "../src/errors";
import {
  ListTransfersQuerySchema,
  validateApproveTransferInput,
  validateCreateTransferDraftInput,
  validateSettlePendingTransferInput,
  validateVoidPendingTransferInput,
} from "../src/validation";

describe("transfers validation (v2)", () => {
  it("validates transfer draft input", () => {
    const result = validateCreateTransferDraftInput({
      sourceOperationalAccountId: "550e8400-e29b-41d4-a716-446655440001",
      destinationOperationalAccountId: "550e8400-e29b-41d4-a716-446655440002",
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
        sourceOperationalAccountId: "550e8400-e29b-41d4-a716-446655440001",
        destinationOperationalAccountId: "550e8400-e29b-41d4-a716-446655440001",
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

  it("coerces ISO timestamps for action inputs", () => {
    const approve = validateApproveTransferInput({
      transferId: "550e8400-e29b-41d4-a716-446655440010",
      checkerUserId: "550e8400-e29b-41d4-a716-446655440011",
      occurredAt: "2026-02-25T00:00:00.000Z",
    });
    const settle = validateSettlePendingTransferInput({
      transferId: "550e8400-e29b-41d4-a716-446655440010",
      eventIdempotencyKey: "settle-1",
      occurredAt: "2026-02-25T00:00:00.000Z",
    });
    const voidPending = validateVoidPendingTransferInput({
      transferId: "550e8400-e29b-41d4-a716-446655440010",
      eventIdempotencyKey: "void-1",
      occurredAt: "2026-02-25T00:00:00.000Z",
    });

    expect(approve.occurredAt).toBeInstanceOf(Date);
    expect(settle.occurredAt).toBeInstanceOf(Date);
    expect(voidPending.occurredAt).toBeInstanceOf(Date);
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

  it("parses list query with toolbar filters", () => {
    const result = ListTransfersQuerySchema.parse({
      query: "acme",
      status: ["draft", "pending"],
      kind: ["cross_org"],
      settlementMode: ["pending"],
    });

    expect(result.query).toBe("acme");
    expect(result.status).toEqual(["draft", "pending"]);
    expect(result.kind).toEqual(["cross_org"]);
    expect(result.settlementMode).toEqual(["pending"]);
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

  it("rejects non-positive amountMinor in draft input", () => {
    expect(() =>
      validateCreateTransferDraftInput({
        sourceOperationalAccountId: "550e8400-e29b-41d4-a716-446655440001",
        destinationOperationalAccountId: "550e8400-e29b-41d4-a716-446655440002",
        idempotencyKey: "draft-key",
        amountMinor: 0,
        makerUserId: "550e8400-e29b-41d4-a716-446655440003",
      }),
    ).toThrow(ValidationError);
  });

  it("rejects non-integer amountMinor in draft input", () => {
    expect(() =>
      validateCreateTransferDraftInput({
        sourceOperationalAccountId: "550e8400-e29b-41d4-a716-446655440001",
        destinationOperationalAccountId: "550e8400-e29b-41d4-a716-446655440002",
        idempotencyKey: "draft-key",
        amountMinor: "1.5",
        makerUserId: "550e8400-e29b-41d4-a716-446655440003",
      }),
    ).toThrow(ValidationError);
  });
});
