import { describe, expect, it, vi } from "vitest";

import {
  CreatePlannedTreasuryOperationInputSchema,
  TreasuryOperationKindSchema,
} from "../src/contracts";
import { createTreasuryOperationsService } from "../src/operations/application";

function createOperationRow() {
  return {
    amountMinor: 10000n,
    counterAmountMinor: null,
    counterCurrencyId: null,
    createdAt: new Date("2026-04-03T10:00:00.000Z"),
    currencyId: "00000000-0000-4000-8000-000000000101",
    customerId: "00000000-0000-4000-8000-000000000201",
    dealId: "00000000-0000-4000-8000-000000000301",
    id: "00000000-0000-4000-8000-000000000401",
    internalEntityOrganizationId: "00000000-0000-4000-8000-000000000501",
    kind: "payin" as const,
    quoteId: null,
    sourceRef: "deal:deal-1:leg:1:payin:1",
    state: "planned" as const,
    updatedAt: new Date("2026-04-03T10:00:00.000Z"),
  };
}

describe("treasury operations service", () => {
  it("returns the existing operation when sourceRef already exists", async () => {
    const existing = createOperationRow();
    const operations = createTreasuryOperationsService({
      operationsRepository: {
        findOperationById: vi.fn(),
        findOperationBySourceRef: vi.fn(async () => existing),
        insertOperation: vi.fn(async () => null),
      },
      runtime: {
        generateUuid: vi.fn(),
        log: vi.fn(),
        logger: vi.fn(),
        now: vi.fn(),
      } as any,
    });

    const result = await operations.commands.createOrGetPlanned({
      amountMinor: 10000n,
      counterAmountMinor: null,
      counterCurrencyId: null,
      currencyId: "00000000-0000-4000-8000-000000000101",
      customerId: "00000000-0000-4000-8000-000000000201",
      dealId: "00000000-0000-4000-8000-000000000301",
      id: "00000000-0000-4000-8000-000000000402",
      internalEntityOrganizationId: "00000000-0000-4000-8000-000000000501",
      kind: "payin",
      quoteId: null,
      sourceRef: "deal:deal-1:leg:1:payin:1",
    });

    expect(result).toMatchObject({
      id: existing.id,
      kind: "payin",
      sourceRef: existing.sourceRef,
      state: "planned",
    });
  });

  it("rejects unsupported treasury operation kinds at the contract layer", () => {
    expect(TreasuryOperationKindSchema.safeParse("internal_treasury").success).toBe(
      false,
    );
    expect(
      CreatePlannedTreasuryOperationInputSchema.safeParse({
        amountMinor: 10000n,
        counterAmountMinor: null,
        counterCurrencyId: null,
        currencyId: "00000000-0000-4000-8000-000000000101",
        customerId: "00000000-0000-4000-8000-000000000201",
        dealId: "00000000-0000-4000-8000-000000000301",
        id: "00000000-0000-4000-8000-000000000401",
        internalEntityOrganizationId: "00000000-0000-4000-8000-000000000501",
        kind: "internal_treasury",
        quoteId: null,
        sourceRef: "deal:deal-1:leg:1:internal_treasury:1",
      }).success,
    ).toBe(false);
  });
});
