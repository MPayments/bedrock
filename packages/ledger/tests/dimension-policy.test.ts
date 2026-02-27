import { describe, expect, it, vi } from "vitest";

import { ACCOUNT_NO, CLEARING_KIND } from "@bedrock/accounting";
import { schema } from "@bedrock/db/schema";

import { createDimensionPolicyValidator } from "../src/internal/commit/dimension-policy";
import { DimensionPolicyViolationError } from "../src/errors";

function createDimensionPolicyTx() {
  return {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          if (table === schema.chartAccountDimensionPolicy) {
            return Promise.resolve([
              { dimensionKey: "clearingKind", mode: "required" },
              { dimensionKey: "counterpartyId", mode: "optional" },
              { dimensionKey: "orderId", mode: "optional" },
              { dimensionKey: "operationalAccountId", mode: "forbidden" },
              { dimensionKey: "feeBucket", mode: "forbidden" },
              { dimensionKey: "customerId", mode: "forbidden" },
            ]);
          }
          if (table === schema.postingCodeDimensionPolicy) {
            return Promise.resolve([]);
          }

          return {
            limit: vi.fn(async () => {
              if (table === schema.correspondenceRules) {
                return [{ id: "rule-1" }];
              }
              if (table === schema.chartTemplateAccounts) {
                return [{ postingAllowed: true, enabled: true }];
              }
              return [];
            }),
          };
        }),
      })),
    })),
  } as any;
}

function createClearingLine(overrides: Record<string, unknown> = {}) {
  return {
    type: "create" as const,
    planRef: "line-1",
    postingCode: "TR.CROSS.SOURCE.IMMEDIATE",
    debit: {
      accountNo: ACCOUNT_NO.CLEARING,
      currency: "USD",
      dimensions: {
        clearingKind: CLEARING_KIND.INTERCOMPANY,
        counterpartyId: "550e8400-e29b-41d4-a716-446655440777",
      },
    },
    credit: {
      accountNo: ACCOUNT_NO.CLEARING,
      currency: "USD",
      dimensions: {
        clearingKind: CLEARING_KIND.INTERCOMPANY,
        counterpartyId: "550e8400-e29b-41d4-a716-446655440778",
      },
    },
    amountMinor: 10n,
    ...overrides,
  };
}

describe("dimension policy validator", () => {
  it("accepts valid clearing dimensions for intercompany kind", async () => {
    const tx = createDimensionPolicyTx();
    const validateCreateLine = createDimensionPolicyValidator(tx);

    await expect(validateCreateLine(createClearingLine())).resolves.toBe(
      undefined,
    );
  });

  it("rejects forbidden dimensions for intercompany clearing kind", async () => {
    const tx = createDimensionPolicyTx();
    const validateCreateLine = createDimensionPolicyValidator(tx);

    await expect(
      validateCreateLine(
        createClearingLine({
          debit: {
            accountNo: ACCOUNT_NO.CLEARING,
            currency: "USD",
            dimensions: {
              clearingKind: CLEARING_KIND.INTERCOMPANY,
              counterpartyId: "550e8400-e29b-41d4-a716-446655440777",
              orderId: "550e8400-e29b-41d4-a716-446655440779",
            },
          },
        }),
      ),
    ).rejects.toThrow(DimensionPolicyViolationError);
  });
});
