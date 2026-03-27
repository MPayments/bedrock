import { describe, expect, it, vi } from "vitest";

const {
  baseOpenObligation,
  baseRecordExecutionEvent,
  baseSettlePosition,
  issueOperation,
  workflowOpenObligation,
  workflowRecordExecutionEvent,
  workflowSettlePosition,
  createTreasuryModule,
  createTreasuryPostingWorkflow,
} = vi.hoisted(() => ({
  baseOpenObligation: vi.fn(async () => ({ id: "base-obligation" })),
  baseRecordExecutionEvent: vi.fn(async () => ({ event: { id: "base-event" } })),
  baseSettlePosition: vi.fn(async () => ({ id: "base-position" })),
  issueOperation: vi.fn(async () => ({ id: "operation-1" })),
  workflowOpenObligation: vi.fn(async () => ({ id: "workflow-obligation" })),
  workflowRecordExecutionEvent: vi.fn(async () => ({ event: { id: "workflow-event" } })),
  workflowSettlePosition: vi.fn(async () => ({ id: "workflow-position" })),
  createTreasuryModule: vi.fn(),
  createTreasuryPostingWorkflow: vi.fn(),
}));

vi.mock("@bedrock/treasury", () => ({
  createTreasuryModule,
}));

vi.mock("@bedrock/treasury/adapters/drizzle", () => ({
  DrizzleTreasuryCoreRepository: class {
    constructor(_db: unknown) {}
  },
  DrizzleTreasuryFeeRulesRepository: class {
    constructor(_db: unknown) {}
  },
  DrizzleTreasuryQuoteFeeComponentsRepository: class {
    constructor(_db: unknown) {}
  },
  DrizzleTreasuryQuoteFinancialLinesRepository: class {
    constructor(_db: unknown) {}
  },
  DrizzleTreasuryQuotesRepository: class {
    constructor(_db: unknown) {}
  },
  DrizzleTreasuryRatesRepository: class {
    constructor(_db: unknown) {}
  },
  DrizzleTreasuryUnitOfWork: class {
    constructor(_input: unknown) {}
  },
}));

vi.mock("@bedrock/treasury/providers", () => ({
  createDefaultRateSourceProviders: vi.fn(() => ({})),
}));

vi.mock("@bedrock/workflow-treasury-posting", () => ({
  createTreasuryPostingWorkflow,
}));

import { createApiTreasuryModule } from "../../src/composition/treasury-module";

describe("API treasury module composition", () => {
  it("wraps selected treasury commands with the posting workflow and leaves the rest direct", async () => {
    createTreasuryModule.mockReturnValue({
      accounts: {
        commands: {
          createTreasuryAccount: vi.fn(),
          createTreasuryEndpoint: vi.fn(),
          createCounterpartyEndpoint: vi.fn(),
        },
        queries: {
          getTreasuryAccountBalances: vi.fn(),
        },
      },
      obligations: {
        commands: {
          openObligation: baseOpenObligation,
        },
        queries: {
          getObligationOutstanding: vi.fn(),
        },
      },
      operations: {
        commands: {
          issueOperation,
          approveOperation: vi.fn(),
          reserveOperationFunds: vi.fn(),
        },
        queries: {
          getOperationTimeline: vi.fn(),
        },
      },
      executions: {
        commands: {
          createExecutionInstruction: vi.fn(),
          recordExecutionEvent: baseRecordExecutionEvent,
        },
        queries: {
          listUnmatchedExternalRecords: vi.fn(),
        },
      },
      allocations: {
        commands: {
          allocateExecution: vi.fn(),
        },
      },
      positions: {
        commands: {
          settlePosition: baseSettlePosition,
        },
        queries: {
          listTreasuryPositions: vi.fn(),
        },
      },
      controls: {
        queries: {
          findOperationByIdempotencyKey: vi.fn(),
        },
      },
      pricing: {
        rates: {
          commands: {
            syncRatesFromSource: vi.fn(),
            setManualRate: vi.fn(),
          },
          queries: {
            getLatestRate: vi.fn(),
          },
        },
        quotes: {
          commands: {
            createQuote: vi.fn(),
          },
          queries: {
            previewQuote: vi.fn(),
          },
        },
        fees: {
          commands: {
            upsertFeeRule: vi.fn(),
          },
          queries: {
            listFeeRules: vi.fn(),
          },
        },
      },
    });
    createTreasuryPostingWorkflow.mockReturnValue({
      openObligation: workflowOpenObligation,
      recordExecutionEvent: workflowRecordExecutionEvent,
      settlePosition: workflowSettlePosition,
    });

    const module = createApiTreasuryModule({
      db: {} as any,
      logger: {
        child: vi.fn(function child() {
          return this;
        }),
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      } as any,
      idempotency: {} as any,
      currencies: {
        findByCode: vi.fn(),
        findById: vi.fn(),
      },
      persistence: {} as any,
    });

    await expect(
      module.obligations.commands.openObligation({
        obligationKind: "ap_invoice",
      } as any),
    ).resolves.toEqual({ id: "workflow-obligation" });
    await expect(
      module.executions.commands.recordExecutionEvent({
        instructionId: "instruction-1",
        eventKind: "settled",
      } as any),
    ).resolves.toEqual({ event: { id: "workflow-event" } });
    await expect(
      module.positions.commands.settlePosition({
        positionId: "position-1",
        amountMinor: "10",
      } as any),
    ).resolves.toEqual({ id: "workflow-position" });
    await expect(
      module.operations.commands.issueOperation({
        operationKind: "payout",
      } as any),
    ).resolves.toEqual({ id: "operation-1" });

    expect(workflowOpenObligation).toHaveBeenCalledTimes(1);
    expect(workflowRecordExecutionEvent).toHaveBeenCalledTimes(1);
    expect(workflowSettlePosition).toHaveBeenCalledTimes(1);
    expect(baseOpenObligation).not.toHaveBeenCalled();
    expect(baseRecordExecutionEvent).not.toHaveBeenCalled();
    expect(baseSettlePosition).not.toHaveBeenCalled();
    expect(issueOperation).toHaveBeenCalledTimes(1);
    expect(createTreasuryPostingWorkflow).toHaveBeenCalledTimes(1);
  });
});
