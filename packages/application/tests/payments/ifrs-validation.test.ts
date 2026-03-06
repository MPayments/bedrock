import { describe, expect, it } from "vitest";

import {
  CapitalFundingInputSchema,
  CapitalFundingPayloadSchema,
  TransferIntraInputSchema,
  TransferIntraPayloadSchema,
} from "../../src/ifrs-documents/validation";

describe("ifrs documents validation", () => {
  it("accepts API amount and maps it to amountMinor", () => {
    const parsed = TransferIntraInputSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      sourceCounterpartyAccountId: "00000000-0000-4000-8000-000000000001",
      destinationCounterpartyAccountId: "00000000-0000-4000-8000-000000000002",
      amount: "1000.50",
      currency: "usd",
    });

    expect(parsed.currency).toBe("USD");
    expect(parsed.amountMinor).toBe("100050");
    expect("amount" in parsed).toBe(false);
  });

  it("keeps payload parsing compatible with amountMinor", () => {
    const parsed = TransferIntraPayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      sourceCounterpartyAccountId: "00000000-0000-4000-8000-000000000001",
      destinationCounterpartyAccountId: "00000000-0000-4000-8000-000000000002",
      sourceCounterpartyId: "00000000-0000-4000-8000-000000000003",
      destinationCounterpartyId: "00000000-0000-4000-8000-000000000004",
      amountMinor: "100050",
      currency: "USD",
    });

    expect(parsed.amountMinor).toBe("100050");
  });

  it("accepts capital funding without entryRef", () => {
    const parsed = CapitalFundingInputSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      kind: "founder_equity",
      counterpartyId: "00000000-0000-4000-8000-000000000003",
      counterpartyAccountId: "00000000-0000-4000-8000-000000000001",
      amount: "1000.50",
      currency: "usd",
    });

    expect(parsed.entryRef).toBeUndefined();
    expect(parsed.currency).toBe("USD");
    expect(parsed.amountMinor).toBe("100050");
  });

  it("keeps capital funding payload parsing compatible without entryRef", () => {
    const parsed = CapitalFundingPayloadSchema.parse({
      occurredAt: "2026-03-03T10:00:00.000Z",
      kind: "founder_equity",
      counterpartyId: "00000000-0000-4000-8000-000000000003",
      counterpartyAccountId: "00000000-0000-4000-8000-000000000001",
      amountMinor: "100050",
      currency: "USD",
    });

    expect(parsed.entryRef).toBeUndefined();
    expect(parsed.amountMinor).toBe("100050");
  });
});
