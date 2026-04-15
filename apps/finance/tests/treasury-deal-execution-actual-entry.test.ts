import { describe, expect, it } from "vitest";

import type { FinanceDealWorkbench as FinanceDealWorkbenchData } from "@/features/treasury/deals/lib/queries";
import {
  buildCashMovementPayload,
  buildExecutionFeePayload,
  buildExecutionFillPayload,
  findExecutionActualOperationContext,
  parseMetadataInput,
} from "@/features/treasury/deals/lib/execution-actual-entry";

function createDeal(): FinanceDealWorkbenchData {
  return {
    acceptedCalculation: {
      acceptedAt: "2026-04-02T08:15:00.000Z",
      calculationId: "calc-1",
      calculationTimestamp: "2026-04-02T08:15:00.000Z",
      pricingProvenance: {
        mode: "route",
      },
      quoteProvenance: null,
      routeVersionId: "route-version-1",
      snapshotId: "snapshot-1",
      state: "accepted",
    },
    executionPlan: [
      {
        actions: {
          canCreateLegOperation: false,
          exchangeDocument: null,
        },
        id: "leg-1",
        idx: 1,
        kind: "collect",
        operationRefs: [
          {
            kind: "payin",
            operationId: "operation-1",
            sourceRef: "deal-leg:collect",
          },
        ],
        state: "done",
      },
    ],
    relatedResources: {
      operations: [
        {
          actions: {
            canPrepareInstruction: false,
            canRequestReturn: false,
            canRetryInstruction: false,
            canSubmitInstruction: false,
            canVoidInstruction: false,
          },
          availableOutcomeTransitions: [],
          id: "operation-1",
          instructionStatus: "settled",
          kind: "payin",
          latestInstruction: {
            attempt: 1,
            createdAt: new Date("2026-04-02T08:10:00.000Z"),
            failedAt: null,
            id: "instruction-1",
            operationId: "operation-1",
            providerRef: null,
            providerSnapshot: null,
            returnRequestedAt: null,
            returnedAt: null,
            settledAt: new Date("2026-04-02T08:30:00.000Z"),
            sourceRef: "instruction-1",
            state: "settled",
            submittedAt: new Date("2026-04-02T08:20:00.000Z"),
            updatedAt: new Date("2026-04-02T08:30:00.000Z"),
            voidedAt: null,
          },
          operationHref: "/treasury/operations/operation-1",
          sourceRef: "deal-leg:collect",
          state: "planned",
        },
      ],
    },
  } as unknown as FinanceDealWorkbenchData;
}

describe("treasury deal execution actual entry helpers", () => {
  it("derives operation linkage from the accepted calculation and execution plan", () => {
    const context = findExecutionActualOperationContext(createDeal(), "operation-1");

    expect(context).toEqual({
      calculationSnapshotId: "snapshot-1",
      instructionId: "instruction-1",
      operationId: "operation-1",
      routeLegId: "leg-1",
      routeVersionId: "route-version-1",
    });
  });

  it("builds manual payloads for fill, fee, and cash movement", () => {
    const context = findExecutionActualOperationContext(createDeal(), "operation-1");

    expect(context).not.toBeNull();

    expect(
      buildExecutionFillPayload(context!, {
        boughtAmountMinor: "970000",
        boughtCurrencyId: "currency-usd",
        executedAt: "2026-04-02T08:30:00.000Z",
        externalRecordId: "ext-fill-1",
        fillSequence: 1,
        metadata: {
          sourceFile: "statement.csv",
        },
        notes: "manual fill",
        providerRef: "provider-fill-1",
        soldAmountMinor: "100000000",
        soldCurrencyId: "currency-rub",
      }),
    ).toMatchObject({
      calculationSnapshotId: "snapshot-1",
      instructionId: "instruction-1",
      routeLegId: "leg-1",
      routeVersionId: "route-version-1",
      sourceKind: "manual",
    });

    expect(
      buildExecutionFeePayload(context!, {
        amountMinor: "2500",
        chargedAt: "2026-04-02T08:35:00.000Z",
        componentCode: "wire_fee",
        currencyId: "currency-rub",
        externalRecordId: "ext-fee-1",
        feeFamily: "provider_fee",
        fillId: null,
        notes: "manual fee",
        providerRef: "provider-fee-1",
      }),
    ).toMatchObject({
      amountMinor: "2500",
      calculationSnapshotId: "snapshot-1",
      currencyId: "currency-rub",
      routeLegId: "leg-1",
      sourceKind: "manual",
    });

    expect(
      buildCashMovementPayload(context!, {
        accountRef: "account-1",
        amountMinor: "100000000",
        bookedAt: "2026-04-02T08:40:00.000Z",
        currencyId: "currency-rub",
        direction: "debit",
        externalRecordId: "ext-cash-1",
        notes: "manual cash",
        providerRef: "provider-cash-1",
        requisiteId: "requisite-1",
        statementRef: "statement-1",
        valueDate: "2026-04-02T08:40:00.000Z",
      }),
    ).toMatchObject({
      calculationSnapshotId: "snapshot-1",
      currencyId: "currency-rub",
      routeLegId: "leg-1",
      statementRef: "statement-1",
      sourceKind: "manual",
    });
  });

  it("rejects non-object metadata payloads", () => {
    expect(parseMetadataInput('["bad"]')).toEqual({
      message: "Metadata должна быть JSON-объектом",
      ok: false,
      value: null,
    });
  });
});
