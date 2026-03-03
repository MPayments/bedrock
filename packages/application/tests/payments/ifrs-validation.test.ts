import { describe, expect, it } from "vitest";

import {
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
});
