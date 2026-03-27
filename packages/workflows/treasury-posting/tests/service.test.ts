import { describe, expect, it, vi } from "vitest";

import { createTreasuryPostingWorkflow } from "../src";

describe("treasury posting workflow", () => {
  it("opens obligations and commits the resolved posting intent", async () => {
    const tx = { id: "tx-1" };
    const openObligation = vi.fn(async () => ({
      id: "obligation-1",
      obligationKind: "ap_invoice",
      debtorEntityId: "org-a",
      creditorEntityId: "vendor-1",
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      assetId: "asset-usd",
      amountMinor: "1000",
      settledMinor: "0",
      dueAt: null,
      memo: "invoice",
      payload: null,
      createdAt: new Date("2026-03-27T10:00:00.000Z"),
      updatedAt: new Date("2026-03-27T10:00:00.000Z"),
    }));
    const resolvePostingPlan = vi.fn(async () => ({
      intent: { lines: [{ id: "line-1" }] },
    }));
    const commit = vi.fn(async () => ({ operationId: "ledger-1" }));
    const ensureDefaultOrganizationBook = vi.fn(async () => ({
      bookId: "book-a",
    }));

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi.fn(async () => ({ code: "USD" })),
      },
      createTreasuryModule: vi.fn(() => ({
        obligations: {
          commands: {
            openObligation,
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: "org-a",
        })),
        findInstruction: vi.fn(),
        listInstructionEvents: vi.fn(),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook,
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    const result = await workflow.openObligation({
      obligationKind: "ap_invoice",
      debtorEntityId: "org-a",
      creditorEntityId: "vendor-1",
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      assetId: "asset-usd",
      amountMinor: "1000",
      dueAt: null,
      memo: "invoice",
      payload: null,
    });

    expect(result.id).toBe("obligation-1");
    expect(ensureDefaultOrganizationBook).toHaveBeenCalledWith({
      organizationId: "org-a",
    });
    expect(resolvePostingPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        accountingSourceId: "treasury_obligation_opened",
        source: {
          type: "treasury/obligations/open",
          id: "obligation-1",
        },
        idempotencyKey: "treasury:obligation-open:obligation-1",
      }),
    );
    expect(commit).toHaveBeenCalledWith({ lines: [{ id: "line-1" }] });
  });

  it("posts submitted execution events through accounting and ledger", async () => {
    const tx = { id: "tx-1" };
    const resolvePostingPlan = vi.fn(async () => ({
      intent: { lines: [{ id: "submitted-line" }] },
    }));
    const commit = vi.fn(async () => ({ operationId: "ledger-2" }));
    const ensureDefaultOrganizationBook = vi.fn(async () => ({
      bookId: "book-a",
    }));

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi.fn(async () => ({ code: "USD" })),
      },
      createTreasuryModule: vi.fn(() => ({
        executions: {
          commands: {
            recordExecutionEvent: vi.fn(async () => ({
              event: {
                id: "event-1",
                instructionId: "instruction-1",
                eventKind: "submitted",
                eventAt: new Date("2026-03-27T10:01:00.000Z"),
                externalRecordId: null,
                metadata: null,
                createdAt: new Date("2026-03-27T10:01:00.000Z"),
              },
              operation: {
                id: "operation-1",
                idempotencyKey: "op-1",
                operationKind: "payout",
                economicOwnerEntityId: "org-a",
                executingEntityId: "org-a",
                cashHolderEntityId: "org-a",
                beneficialOwnerType: null,
                beneficialOwnerId: null,
                legalBasis: null,
                settlementModel: "direct",
                instructionStatus: "submitted",
                sourceAccountId: "account-1",
                destinationAccountId: null,
                sourceAssetId: "asset-usd",
                destinationAssetId: "asset-usd",
                sourceAmountMinor: "1000",
                destinationAmountMinor: "1000",
                memo: null,
                payload: null,
                createdAt: new Date("2026-03-27T10:00:00.000Z"),
                updatedAt: new Date("2026-03-27T10:01:00.000Z"),
                approvedAt: null,
                reservedAt: null,
              },
            })),
            createExecutionInstruction: vi.fn(),
          },
        },
        operations: {
          queries: {
            getOperationTimeline: vi.fn(async () => ({
              operation: {} as any,
              obligations: [],
              instructions: ["instruction-1"],
              events: ["event-1"],
              positions: [],
            })),
          },
        },
        positions: {
          queries: {
            listTreasuryPositions: vi.fn(async () => []),
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: "org-a",
        })),
        findInstruction: vi.fn(async () => ({
          id: "instruction-1",
          operationId: "operation-1",
          sourceAccountId: "account-1",
          destinationEndpointId: "endpoint-1",
          assetId: "asset-usd",
          amountMinor: 1000n,
          metadata: null,
        })),
        listInstructionEvents: vi.fn(async () => []),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook,
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    await workflow.recordExecutionEvent({
      instructionId: "instruction-1",
      eventKind: "submitted",
    });

    expect(resolvePostingPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        accountingSourceId: "treasury_execution_submitted",
        source: {
          type: "treasury/execution-events/submitted",
          id: "event-1",
        },
      }),
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("posts settled execution events and only newly opened positions", async () => {
    const tx = { id: "tx-1" };
    const resolvePostingPlan = vi.fn(async ({ source }) => ({
      intent: { lines: [{ id: source.id }] },
    }));
    const commit = vi.fn(async () => ({ operationId: "ledger-3" }));
    const ensureDefaultOrganizationBook = vi.fn(async ({ organizationId }) => ({
      bookId: `book:${organizationId}`,
    }));
    const listTreasuryPositions = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "existing-position",
          originOperationId: "operation-1",
          positionKind: "intercompany_due_from",
          ownerEntityId: "org-a",
          counterpartyEntityId: "org-b",
          beneficialOwnerType: null,
          beneficialOwnerId: null,
          assetId: "asset-usd",
          amountMinor: "1000",
          settledMinor: "0",
          createdAt: new Date("2026-03-27T10:00:00.000Z"),
          updatedAt: new Date("2026-03-27T10:00:00.000Z"),
          closedAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "existing-position",
          originOperationId: "operation-1",
          positionKind: "intercompany_due_from",
          ownerEntityId: "org-a",
          counterpartyEntityId: "org-b",
          beneficialOwnerType: null,
          beneficialOwnerId: null,
          assetId: "asset-usd",
          amountMinor: "1000",
          settledMinor: "0",
          createdAt: new Date("2026-03-27T10:00:00.000Z"),
          updatedAt: new Date("2026-03-27T10:00:00.000Z"),
          closedAt: null,
        },
        {
          id: "position-2",
          originOperationId: "operation-1",
          positionKind: "intercompany_due_from",
          ownerEntityId: "org-a",
          counterpartyEntityId: "org-b",
          beneficialOwnerType: null,
          beneficialOwnerId: null,
          assetId: "asset-usd",
          amountMinor: "1000",
          settledMinor: "0",
          createdAt: new Date("2026-03-27T10:02:00.000Z"),
          updatedAt: new Date("2026-03-27T10:02:00.000Z"),
          closedAt: null,
        },
        {
          id: "position-3",
          originOperationId: "operation-1",
          positionKind: "intercompany_due_to",
          ownerEntityId: "org-b",
          counterpartyEntityId: "org-a",
          beneficialOwnerType: null,
          beneficialOwnerId: null,
          assetId: "asset-usd",
          amountMinor: "1000",
          settledMinor: "0",
          createdAt: new Date("2026-03-27T10:02:00.000Z"),
          updatedAt: new Date("2026-03-27T10:02:00.000Z"),
          closedAt: null,
        },
      ]);

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi.fn(async () => ({ code: "USD" })),
      },
      createTreasuryModule: vi.fn(() => ({
        executions: {
          commands: {
            recordExecutionEvent: vi.fn(async () => ({
              event: {
                id: "event-2",
                instructionId: "instruction-1",
                eventKind: "settled",
                eventAt: new Date("2026-03-27T10:02:00.000Z"),
                externalRecordId: null,
                metadata: { pendingId: "42" },
                createdAt: new Date("2026-03-27T10:02:00.000Z"),
              },
              operation: {
                id: "operation-1",
                idempotencyKey: "op-1",
                operationKind: "payout",
                economicOwnerEntityId: "org-b",
                executingEntityId: "org-a",
                cashHolderEntityId: "org-a",
                beneficialOwnerType: null,
                beneficialOwnerId: null,
                legalBasis: null,
                settlementModel: "pobo",
                instructionStatus: "settled",
                sourceAccountId: "account-1",
                destinationAccountId: null,
                sourceAssetId: "asset-usd",
                destinationAssetId: "asset-usd",
                sourceAmountMinor: "1000",
                destinationAmountMinor: "1000",
                memo: null,
                payload: null,
                createdAt: new Date("2026-03-27T10:00:00.000Z"),
                updatedAt: new Date("2026-03-27T10:02:00.000Z"),
                approvedAt: null,
                reservedAt: new Date("2026-03-27T10:01:00.000Z"),
              },
            })),
            createExecutionInstruction: vi.fn(),
          },
        },
        operations: {
          queries: {
            getOperationTimeline: vi.fn(async () => ({
              operation: {} as any,
              obligations: [],
              instructions: ["instruction-1"],
              events: ["event-2"],
              positions: ["position-2", "position-3"],
            })),
          },
        },
        positions: {
          queries: {
            listTreasuryPositions,
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: id === "account-1" ? "org-a" : "org-b",
        })),
        findInstruction: vi.fn(async () => ({
          id: "instruction-1",
          operationId: "operation-1",
          sourceAccountId: "account-1",
          destinationEndpointId: "endpoint-1",
          assetId: "asset-usd",
          amountMinor: 1000n,
          metadata: null,
        })),
        listInstructionEvents: vi.fn(async () => [{ eventKind: "submitted" }]),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook,
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    await workflow.recordExecutionEvent({
      instructionId: "instruction-1",
      eventKind: "settled",
      metadata: {
        pendingId: "42",
      },
    });

    expect(commit).toHaveBeenCalledTimes(3);
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        accountingSourceId: "treasury_execution_settled",
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        accountingSourceId: "treasury_position_opened",
        source: {
          type: "treasury/positions/open",
          id: "position-2",
        },
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        accountingSourceId: "treasury_position_opened",
        source: {
          type: "treasury/positions/open",
          id: "position-3",
        },
      }),
    );
  });

  it("skips accounting and ledger for treasury-only execution events", async () => {
    const tx = { id: "tx-1" };
    const resolvePostingPlan = vi.fn();
    const commit = vi.fn();

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi.fn(async () => ({ code: "USD" })),
      },
      createTreasuryModule: vi.fn(() => ({
        executions: {
          commands: {
            recordExecutionEvent: vi.fn(async () => ({
              event: {
                id: "event-accepted",
                instructionId: "instruction-1",
                eventKind: "accepted",
                eventAt: new Date("2026-03-27T10:03:00.000Z"),
                externalRecordId: null,
                metadata: null,
                createdAt: new Date("2026-03-27T10:03:00.000Z"),
              },
              operation: {
                id: "operation-1",
                idempotencyKey: "op-1",
                operationKind: "payout",
                economicOwnerEntityId: "org-a",
                executingEntityId: "org-a",
                cashHolderEntityId: "org-a",
                beneficialOwnerType: null,
                beneficialOwnerId: null,
                legalBasis: null,
                settlementModel: "direct",
                instructionStatus: "submitted",
                sourceAccountId: "account-1",
                destinationAccountId: null,
                sourceAssetId: "asset-usd",
                destinationAssetId: "asset-usd",
                sourceAmountMinor: "1000",
                destinationAmountMinor: "1000",
                memo: null,
                payload: null,
                createdAt: new Date("2026-03-27T10:00:00.000Z"),
                updatedAt: new Date("2026-03-27T10:03:00.000Z"),
                approvedAt: null,
                reservedAt: null,
              },
            })),
            createExecutionInstruction: vi.fn(),
          },
        },
        operations: {
          queries: {
            getOperationTimeline: vi.fn(async () => ({
              operation: {} as any,
              obligations: [],
              instructions: ["instruction-1"],
              events: ["event-accepted"],
              positions: [],
            })),
          },
        },
        positions: {
          queries: {
            listTreasuryPositions: vi.fn(async () => []),
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: "org-a",
        })),
        findInstruction: vi.fn(async () => ({
          id: "instruction-1",
          operationId: "operation-1",
          sourceAccountId: "account-1",
          destinationEndpointId: null,
          assetId: "asset-usd",
          amountMinor: 1000n,
          metadata: null,
        })),
        listInstructionEvents: vi.fn(async () => []),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook: vi.fn(async () => ({
              bookId: "book-a",
            })),
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    await workflow.recordExecutionEvent({
      instructionId: "instruction-1",
      eventKind: "accepted",
    });

    expect(resolvePostingPlan).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("settles positions and commits the resolved posting intent", async () => {
    const tx = { id: "tx-1" };
    const resolvePostingPlan = vi.fn(async () => ({
      intent: { lines: [{ id: "position-line" }] },
    }));
    const commit = vi.fn(async () => ({ operationId: "ledger-4" }));

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi.fn(async () => ({ code: "USD" })),
      },
      createTreasuryModule: vi.fn(() => ({
        positions: {
          commands: {
            settlePosition: vi.fn(async () => ({
              id: "position-1",
              originOperationId: "operation-1",
              positionKind: "customer_liability",
              ownerEntityId: "org-a",
              counterpartyEntityId: null,
              beneficialOwnerType: "customer",
              beneficialOwnerId: "customer-1",
              assetId: "asset-usd",
              amountMinor: "1000",
              settledMinor: "400",
              createdAt: new Date("2026-03-27T10:00:00.000Z"),
              updatedAt: new Date("2026-03-27T10:04:00.000Z"),
              closedAt: null,
            })),
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: "org-a",
        })),
        findInstruction: vi.fn(),
        listInstructionEvents: vi.fn(),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook: vi.fn(async () => ({
              bookId: "book-a",
            })),
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    await workflow.settlePosition({
      positionId: "position-1",
      amountMinor: "400",
    });

    expect(resolvePostingPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        accountingSourceId: "treasury_position_settled",
        source: {
          type: "treasury/positions/settle",
          id: "position-1:400",
        },
      }),
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("posts settled intracompany transfers with direct treasury transfer templates", async () => {
    const tx = { id: "tx-1" };
    const resolvePostingPlan = vi.fn(async ({ plan }) => ({
      intent: { lines: [{ id: plan.requests[0].templateKey }] },
    }));
    const commit = vi.fn(async () => ({ operationId: "ledger-transfer-1" }));

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi.fn(async () => ({ code: "USD" })),
      },
      createTreasuryModule: vi.fn(() => ({
        executions: {
          commands: {
            recordExecutionEvent: vi.fn(async () => ({
              event: {
                id: "event-transfer-1",
                instructionId: "instruction-transfer-1",
                eventKind: "settled",
                eventAt: new Date("2026-03-27T11:00:00.000Z"),
                externalRecordId: null,
                metadata: null,
                createdAt: new Date("2026-03-27T11:00:00.000Z"),
              },
              operation: {
                id: "operation-transfer-1",
                idempotencyKey: "transfer-1",
                operationKind: "intracompany_transfer",
                economicOwnerEntityId: "org-a",
                executingEntityId: "org-a",
                cashHolderEntityId: "org-a",
                beneficialOwnerType: null,
                beneficialOwnerId: null,
                legalBasis: null,
                settlementModel: "direct",
                instructionStatus: "settled",
                sourceAccountId: "account-source",
                destinationAccountId: "account-destination",
                sourceAssetId: "asset-usd",
                destinationAssetId: "asset-usd",
                sourceAmountMinor: "1500",
                destinationAmountMinor: "1500",
                memo: null,
                payload: null,
                createdAt: new Date("2026-03-27T10:55:00.000Z"),
                updatedAt: new Date("2026-03-27T11:00:00.000Z"),
                approvedAt: null,
                reservedAt: null,
              },
            })),
          },
        },
        operations: {
          queries: {
            getOperationTimeline: vi.fn(async () => ({
              operation: {} as any,
              obligations: [],
              instructions: ["instruction-transfer-1"],
              events: ["event-transfer-1"],
              positions: [],
            })),
          },
        },
        positions: {
          queries: {
            listTreasuryPositions: vi.fn(async () => []),
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: "org-a",
        })),
        findInstruction: vi.fn(async () => ({
          id: "instruction-transfer-1",
          operationId: "operation-transfer-1",
          sourceAccountId: "account-source",
          destinationEndpointId: null,
          assetId: "asset-usd",
          amountMinor: 1500n,
          metadata: null,
        })),
        listInstructionEvents: vi.fn(async () => []),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook: vi.fn(async () => ({
              bookId: "book-a",
            })),
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    await workflow.recordExecutionEvent({
      instructionId: "instruction-transfer-1",
      eventKind: "settled",
    });

    expect(resolvePostingPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        accountingSourceId: "treasury_execution_settled",
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "transfer.intra.immediate",
            }),
          ],
        }),
      }),
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("posts settled intercompany funding with cash legs and mirrored positions", async () => {
    const tx = { id: "tx-1" };
    const resolvePostingPlan = vi.fn(async ({ source, plan }) => ({
      intent: { lines: [{ id: `${source.id}:${plan.requests[0].templateKey}` }] },
    }));
    const commit = vi.fn(async () => ({ operationId: "ledger-funding-1" }));
    const ensureDefaultOrganizationBook = vi.fn(async ({ organizationId }) => ({
      bookId: `book:${organizationId}`,
    }));
    const listTreasuryPositions = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "position-due-from",
          originOperationId: "operation-funding-1",
          positionKind: "intercompany_due_from",
          ownerEntityId: "org-a",
          counterpartyEntityId: "org-b",
          beneficialOwnerType: null,
          beneficialOwnerId: null,
          assetId: "asset-usd",
          amountMinor: "2500",
          settledMinor: "0",
          createdAt: new Date("2026-03-27T11:10:00.000Z"),
          updatedAt: new Date("2026-03-27T11:10:00.000Z"),
          closedAt: null,
        },
        {
          id: "position-due-to",
          originOperationId: "operation-funding-1",
          positionKind: "intercompany_due_to",
          ownerEntityId: "org-b",
          counterpartyEntityId: "org-a",
          beneficialOwnerType: null,
          beneficialOwnerId: null,
          assetId: "asset-usd",
          amountMinor: "2500",
          settledMinor: "0",
          createdAt: new Date("2026-03-27T11:10:00.000Z"),
          updatedAt: new Date("2026-03-27T11:10:00.000Z"),
          closedAt: null,
        },
      ]);

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi.fn(async () => ({ code: "USD" })),
      },
      createTreasuryModule: vi.fn(() => ({
        executions: {
          commands: {
            recordExecutionEvent: vi.fn(async () => ({
              event: {
                id: "event-funding-1",
                instructionId: "instruction-funding-1",
                eventKind: "settled",
                eventAt: new Date("2026-03-27T11:10:00.000Z"),
                externalRecordId: null,
                metadata: null,
                createdAt: new Date("2026-03-27T11:10:00.000Z"),
              },
              operation: {
                id: "operation-funding-1",
                idempotencyKey: "funding-1",
                operationKind: "intercompany_funding",
                economicOwnerEntityId: "org-b",
                executingEntityId: "org-a",
                cashHolderEntityId: "org-a",
                beneficialOwnerType: null,
                beneficialOwnerId: null,
                legalBasis: "loan",
                settlementModel: "direct",
                instructionStatus: "settled",
                sourceAccountId: "account-a",
                destinationAccountId: "account-b",
                sourceAssetId: "asset-usd",
                destinationAssetId: "asset-usd",
                sourceAmountMinor: "2500",
                destinationAmountMinor: "2500",
                memo: null,
                payload: null,
                createdAt: new Date("2026-03-27T11:00:00.000Z"),
                updatedAt: new Date("2026-03-27T11:10:00.000Z"),
                approvedAt: null,
                reservedAt: null,
              },
            })),
          },
        },
        operations: {
          queries: {
            getOperationTimeline: vi.fn(async () => ({
              operation: {} as any,
              obligations: [],
              instructions: ["instruction-funding-1"],
              events: ["event-funding-1"],
              positions: ["position-due-from", "position-due-to"],
            })),
          },
        },
        positions: {
          queries: {
            listTreasuryPositions,
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: id === "account-a" ? "org-a" : "org-b",
        })),
        findInstruction: vi.fn(async () => ({
          id: "instruction-funding-1",
          operationId: "operation-funding-1",
          sourceAccountId: "account-a",
          destinationEndpointId: null,
          assetId: "asset-usd",
          amountMinor: 2500n,
          metadata: null,
        })),
        listInstructionEvents: vi.fn(async () => []),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook,
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    await workflow.recordExecutionEvent({
      instructionId: "instruction-funding-1",
      eventKind: "settled",
    });

    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.cash_out.immediate",
            }),
          ],
        }),
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.cash_in.immediate",
            }),
          ],
        }),
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        accountingSourceId: "treasury_position_opened",
        source: { type: "treasury/positions/open", id: "position-due-from" },
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        accountingSourceId: "treasury_position_opened",
        source: { type: "treasury/positions/open", id: "position-due-to" },
      }),
    );
    expect(commit).toHaveBeenCalledTimes(4);
  });

  it("posts settled FX conversions with source and destination treasury legs", async () => {
    const tx = { id: "tx-1" };
    const resolvePostingPlan = vi.fn(async ({ plan }) => ({
      intent: { lines: [{ id: plan.requests[0].templateKey }] },
    }));
    const commit = vi.fn(async () => ({ operationId: "ledger-fx-1" }));

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi.fn(async (id: string) => ({
          code: id === "asset-eur" ? "EUR" : "USD",
        })),
      },
      createTreasuryModule: vi.fn(() => ({
        executions: {
          commands: {
            recordExecutionEvent: vi.fn(async () => ({
              event: {
                id: "event-fx-1",
                instructionId: "instruction-fx-1",
                eventKind: "settled",
                eventAt: new Date("2026-03-27T11:20:00.000Z"),
                externalRecordId: null,
                metadata: null,
                createdAt: new Date("2026-03-27T11:20:00.000Z"),
              },
              operation: {
                id: "operation-fx-1",
                idempotencyKey: "fx-1",
                operationKind: "fx_conversion",
                economicOwnerEntityId: "org-a",
                executingEntityId: "org-a",
                cashHolderEntityId: "org-a",
                beneficialOwnerType: null,
                beneficialOwnerId: null,
                legalBasis: null,
                settlementModel: "direct",
                instructionStatus: "settled",
                sourceAccountId: "account-usd",
                destinationAccountId: "account-eur",
                sourceAssetId: "asset-usd",
                destinationAssetId: "asset-eur",
                sourceAmountMinor: "1000",
                destinationAmountMinor: "900",
                memo: null,
                payload: {
                  quoteSnapshot: {
                    quoteId: "quote-1",
                  },
                },
                createdAt: new Date("2026-03-27T11:15:00.000Z"),
                updatedAt: new Date("2026-03-27T11:20:00.000Z"),
                approvedAt: null,
                reservedAt: null,
              },
            })),
          },
        },
        operations: {
          queries: {
            getOperationTimeline: vi.fn(async () => ({
              operation: {} as any,
              obligations: [],
              instructions: ["instruction-fx-1"],
              events: ["event-fx-1"],
              positions: [],
            })),
          },
        },
        positions: {
          queries: {
            listTreasuryPositions: vi.fn(async () => []),
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: "org-a",
        })),
        findInstruction: vi.fn(async () => ({
          id: "instruction-fx-1",
          operationId: "operation-fx-1",
          sourceAccountId: "account-usd",
          destinationEndpointId: null,
          assetId: "asset-usd",
          amountMinor: 1000n,
          metadata: null,
        })),
        listInstructionEvents: vi.fn(async () => []),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook: vi.fn(async () => ({
              bookId: "book-a",
            })),
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    await workflow.recordExecutionEvent({
      instructionId: "instruction-fx-1",
      eventKind: "settled",
    });

    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.fx.source.immediate",
            }),
          ],
        }),
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.fx.destination.immediate",
            }),
          ],
        }),
      }),
    );
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("posts settled collections into clearing and only opens customer-liability positions for customer collections", async () => {
    const tx = { id: "tx-1" };
    const resolvePostingPlan = vi.fn(async ({ source, plan }) => ({
      intent: { lines: [{ id: `${source.id}:${plan.requests[0].templateKey}` }] },
    }));
    const commit = vi.fn(async () => ({ operationId: "ledger-collection-1" }));
    const ensureDefaultOrganizationBook = vi.fn(async ({ organizationId }) => ({
      bookId: `book:${organizationId}`,
    }));
    const listTreasuryPositions = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "position-customer",
          originOperationId: "operation-collection-1",
          positionKind: "customer_liability",
          ownerEntityId: "org-a",
          counterpartyEntityId: null,
          beneficialOwnerType: "customer",
          beneficialOwnerId: "customer-1",
          assetId: "asset-usd",
          amountMinor: "2500",
          settledMinor: "0",
          createdAt: new Date("2026-03-27T11:30:00.000Z"),
          updatedAt: new Date("2026-03-27T11:30:00.000Z"),
          closedAt: null,
        },
        {
          id: "position-due-from",
          originOperationId: "operation-collection-1",
          positionKind: "intercompany_due_from",
          ownerEntityId: "org-b",
          counterpartyEntityId: "org-a",
          beneficialOwnerType: null,
          beneficialOwnerId: null,
          assetId: "asset-usd",
          amountMinor: "2500",
          settledMinor: "0",
          createdAt: new Date("2026-03-27T11:30:00.000Z"),
          updatedAt: new Date("2026-03-27T11:30:00.000Z"),
          closedAt: null,
        },
        {
          id: "position-due-to",
          originOperationId: "operation-collection-1",
          positionKind: "intercompany_due_to",
          ownerEntityId: "org-a",
          counterpartyEntityId: "org-b",
          beneficialOwnerType: null,
          beneficialOwnerId: null,
          assetId: "asset-usd",
          amountMinor: "2500",
          settledMinor: "0",
          createdAt: new Date("2026-03-27T11:30:00.000Z"),
          updatedAt: new Date("2026-03-27T11:30:00.000Z"),
          closedAt: null,
        },
      ]);

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi.fn(async () => ({ code: "USD" })),
      },
      createTreasuryModule: vi.fn(() => ({
        executions: {
          commands: {
            recordExecutionEvent: vi.fn(async () => ({
              event: {
                id: "event-collection-1",
                instructionId: "instruction-collection-1",
                eventKind: "settled",
                eventAt: new Date("2026-03-27T11:30:00.000Z"),
                externalRecordId: null,
                metadata: null,
                createdAt: new Date("2026-03-27T11:30:00.000Z"),
              },
              operation: {
                id: "operation-collection-1",
                idempotencyKey: "collection-1",
                operationKind: "collection",
                economicOwnerEntityId: "org-b",
                executingEntityId: "org-a",
                cashHolderEntityId: "org-a",
                beneficialOwnerType: "customer",
                beneficialOwnerId: "customer-1",
                legalBasis: null,
                settlementModel: "robo",
                instructionStatus: "settled",
                sourceAccountId: "account-collection",
                destinationAccountId: null,
                sourceAssetId: "asset-usd",
                destinationAssetId: "asset-usd",
                sourceAmountMinor: "2500",
                destinationAmountMinor: "2500",
                memo: null,
                payload: null,
                createdAt: new Date("2026-03-27T11:25:00.000Z"),
                updatedAt: new Date("2026-03-27T11:30:00.000Z"),
                approvedAt: null,
                reservedAt: null,
              },
            })),
          },
        },
        operations: {
          queries: {
            getOperationTimeline: vi.fn(async () => ({
              operation: {} as any,
              obligations: [],
              instructions: ["instruction-collection-1"],
              events: ["event-collection-1"],
              positions: [
                "position-customer",
                "position-due-from",
                "position-due-to",
              ],
            })),
          },
        },
        positions: {
          queries: {
            listTreasuryPositions,
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: "org-a",
        })),
        findInstruction: vi.fn(async () => ({
          id: "instruction-collection-1",
          operationId: "operation-collection-1",
          sourceAccountId: "account-collection",
          destinationEndpointId: null,
          assetId: "asset-usd",
          amountMinor: 2500n,
          metadata: null,
        })),
        listInstructionEvents: vi.fn(async () => []),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook,
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    await workflow.recordExecutionEvent({
      instructionId: "instruction-collection-1",
      eventKind: "settled",
    });

    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        accountingSourceId: "treasury_execution_settled",
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.cash_in.immediate",
            }),
          ],
        }),
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        accountingSourceId: "treasury_position_opened",
        source: {
          type: "treasury/positions/open",
          id: "position-customer",
        },
      }),
    );
    expect(resolvePostingPlan).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("posts returned collections as cash reversals and settles posted customer-liability positions", async () => {
    const tx = { id: "tx-1" };
    const resolvePostingPlan = vi.fn(async ({ source, plan }) => ({
      intent: { lines: [{ id: `${source.id}:${plan.requests[0].templateKey}` }] },
    }));
    const commit = vi.fn(async () => ({ operationId: "ledger-collection-return-1" }));
    const ensureDefaultOrganizationBook = vi.fn(async ({ organizationId }) => ({
      bookId: `book:${organizationId}`,
    }));
    const settlePosition = vi.fn(async () => ({
      id: "position-customer",
      originOperationId: "operation-collection-1",
      positionKind: "customer_liability",
      ownerEntityId: "org-a",
      counterpartyEntityId: null,
      beneficialOwnerType: "customer",
      beneficialOwnerId: "customer-1",
      assetId: "asset-usd",
      amountMinor: "2500",
      settledMinor: "2500",
      createdAt: new Date("2026-03-27T11:30:00.000Z"),
      updatedAt: new Date("2026-03-27T11:40:00.000Z"),
      closedAt: new Date("2026-03-27T11:40:00.000Z"),
    }));
    const openPositions = [
      {
        id: "position-customer",
        originOperationId: "operation-collection-1",
        positionKind: "customer_liability",
        ownerEntityId: "org-a",
        counterpartyEntityId: null,
        beneficialOwnerType: "customer",
        beneficialOwnerId: "customer-1",
        assetId: "asset-usd",
        amountMinor: "2500",
        settledMinor: "0",
        createdAt: new Date("2026-03-27T11:30:00.000Z"),
        updatedAt: new Date("2026-03-27T11:30:00.000Z"),
        closedAt: null,
      },
      {
        id: "position-due-from",
        originOperationId: "operation-collection-1",
        positionKind: "intercompany_due_from",
        ownerEntityId: "org-b",
        counterpartyEntityId: "org-a",
        beneficialOwnerType: null,
        beneficialOwnerId: null,
        assetId: "asset-usd",
        amountMinor: "2500",
        settledMinor: "0",
        createdAt: new Date("2026-03-27T11:30:00.000Z"),
        updatedAt: new Date("2026-03-27T11:30:00.000Z"),
        closedAt: null,
      },
    ];
    const listTreasuryPositions = vi
      .fn()
      .mockResolvedValueOnce(openPositions)
      .mockResolvedValueOnce(openPositions);

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi.fn(async () => ({ code: "USD" })),
      },
      createTreasuryModule: vi.fn(() => ({
        executions: {
          commands: {
            recordExecutionEvent: vi.fn(async () => ({
              event: {
                id: "event-collection-return-1",
                instructionId: "instruction-collection-1",
                eventKind: "returned",
                eventAt: new Date("2026-03-27T11:40:00.000Z"),
                externalRecordId: null,
                metadata: null,
                createdAt: new Date("2026-03-27T11:40:00.000Z"),
              },
              operation: {
                id: "operation-collection-1",
                idempotencyKey: "collection-1",
                operationKind: "collection",
                economicOwnerEntityId: "org-b",
                executingEntityId: "org-a",
                cashHolderEntityId: "org-a",
                beneficialOwnerType: "customer",
                beneficialOwnerId: "customer-1",
                legalBasis: null,
                settlementModel: "robo",
                instructionStatus: "returned",
                sourceAccountId: "account-collection",
                destinationAccountId: null,
                sourceAssetId: "asset-usd",
                destinationAssetId: "asset-usd",
                sourceAmountMinor: "2500",
                destinationAmountMinor: "2500",
                memo: null,
                payload: null,
                createdAt: new Date("2026-03-27T11:25:00.000Z"),
                updatedAt: new Date("2026-03-27T11:40:00.000Z"),
                approvedAt: null,
                reservedAt: null,
              },
            })),
          },
        },
        operations: {
          queries: {
            getOperationTimeline: vi.fn(async () => ({
              operation: {} as any,
              obligations: [],
              instructions: ["instruction-collection-1"],
              events: ["event-collection-return-1"],
              positions: ["position-customer", "position-due-from"],
            })),
          },
        },
        positions: {
          commands: {
            settlePosition,
          },
          queries: {
            listTreasuryPositions,
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: "org-a",
        })),
        findInstruction: vi.fn(async () => ({
          id: "instruction-collection-1",
          operationId: "operation-collection-1",
          sourceAccountId: "account-collection",
          destinationEndpointId: null,
          assetId: "asset-usd",
          amountMinor: 2500n,
          metadata: null,
        })),
        listInstructionEvents: vi.fn(async () => [
          { eventKind: "submitted" },
          { eventKind: "settled" },
        ]),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook,
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    await workflow.recordExecutionEvent({
      instructionId: "instruction-collection-1",
      eventKind: "returned",
    });

    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        accountingSourceId: "treasury_execution_returned",
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.cash_out.immediate",
            }),
          ],
        }),
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        accountingSourceId: "treasury_position_settled",
        source: {
          type: "treasury/positions/settle",
          id: "position-customer:2500",
        },
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.position.customer_liability.settle",
            }),
          ],
        }),
      }),
    );
    expect(settlePosition).toHaveBeenCalledTimes(1);
    expect(settlePosition).toHaveBeenCalledWith({
      positionId: "position-customer",
      amountMinor: "2500",
    });
    expect(resolvePostingPlan).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("posts settled FX financial lines from quote payload on the canonical treasury path", async () => {
    const tx = { id: "tx-1" };
    const resolvePostingPlan = vi.fn(async ({ plan }) => ({
      intent: { lines: [{ id: plan.requests[0].templateKey }] },
    }));
    const commit = vi.fn(async () => ({ operationId: "ledger-fx-lines-1" }));

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi
          .fn()
          .mockResolvedValueOnce({ code: "USD" })
          .mockResolvedValueOnce({ code: "EUR" }),
      },
      createTreasuryModule: vi.fn(() => ({
        executions: {
          commands: {
            recordExecutionEvent: vi.fn(async () => ({
              event: {
                id: "event-fx-lines-1",
                instructionId: "instruction-fx-lines-1",
                eventKind: "settled",
                eventAt: new Date("2026-03-27T11:45:00.000Z"),
                externalRecordId: null,
                metadata: null,
                createdAt: new Date("2026-03-27T11:45:00.000Z"),
              },
              operation: {
                id: "operation-fx-lines-1",
                idempotencyKey: "fx-lines-1",
                operationKind: "fx_conversion",
                economicOwnerEntityId: "org-a",
                executingEntityId: "org-a",
                cashHolderEntityId: "org-a",
                beneficialOwnerType: null,
                beneficialOwnerId: null,
                legalBasis: null,
                settlementModel: "direct",
                instructionStatus: "settled",
                sourceAccountId: "account-usd",
                destinationAccountId: "account-eur",
                sourceAssetId: "asset-usd",
                destinationAssetId: "asset-eur",
                sourceAmountMinor: "1000",
                destinationAmountMinor: "900",
                memo: "fx conversion",
                payload: {
                  quoteSnapshot: {
                    quoteId: "quote-1",
                    payload: {
                      financialLines: [
                        {
                          id: "line-fee-1",
                          bucket: "fee_revenue",
                          currency: "USD",
                          amountMinor: "25",
                          settlementMode: "in_ledger",
                          memo: "FX fee",
                        },
                        {
                          id: "line-spread-1",
                          bucket: "spread_revenue",
                          currency: "USD",
                          amountMinor: "15",
                          settlementMode: "in_ledger",
                        },
                        {
                          id: "line-provider-1",
                          bucket: "provider_fee_expense",
                          currency: "EUR",
                          amountMinor: "7",
                          settlementMode: "in_ledger",
                        },
                      ],
                    },
                  },
                },
                createdAt: new Date("2026-03-27T11:40:00.000Z"),
                updatedAt: new Date("2026-03-27T11:45:00.000Z"),
                approvedAt: null,
                reservedAt: null,
              },
            })),
          },
        },
        operations: {
          queries: {
            getOperationTimeline: vi.fn(async () => ({
              operation: {} as any,
              obligations: [],
              instructions: ["instruction-fx-lines-1"],
              events: ["event-fx-lines-1"],
              positions: [],
            })),
          },
        },
        positions: {
          queries: {
            listTreasuryPositions: vi.fn(async () => []),
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: "org-a",
        })),
        findInstruction: vi.fn(async () => ({
          id: "instruction-fx-lines-1",
          operationId: "operation-fx-lines-1",
          sourceAccountId: "account-usd",
          destinationEndpointId: null,
          assetId: "asset-usd",
          amountMinor: 1000n,
          metadata: null,
        })),
        listInstructionEvents: vi.fn(async () => []),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook: vi.fn(async () => ({
              bookId: "book-a",
            })),
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    await workflow.recordExecutionEvent({
      instructionId: "instruction-fx-lines-1",
      eventKind: "settled",
    });

    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.fx.source.immediate",
            }),
          ],
        }),
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.fx.destination.immediate",
            }),
          ],
        }),
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.fx.fee_income",
            }),
          ],
        }),
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.fx.spread_income",
            }),
          ],
        }),
      }),
    );
    expect(resolvePostingPlan).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        plan: expect.objectContaining({
          requests: [
            expect.objectContaining({
              templateKey: "treasury.fx.provider_fee_expense",
            }),
          ],
        }),
      }),
    );
    expect(commit).toHaveBeenCalledTimes(5);
  });

  it("bubbles failures so the surrounding transaction can roll back", async () => {
    const tx = { id: "tx-1" };
    const resolvePostingPlan = vi.fn(async () => ({
      intent: { lines: [{ id: "line-1" }] },
    }));
    const commit = vi.fn(async () => {
      throw new Error("ledger failed");
    });

    const workflow = createTreasuryPostingWorkflow({
      db: {
        transaction: vi.fn(async (run) => run(tx as any)),
      } as any,
      currencies: {
        findById: vi.fn(async () => ({ code: "USD" })),
      },
      createTreasuryModule: vi.fn(() => ({
        obligations: {
          commands: {
            openObligation: vi.fn(async () => ({
              id: "obligation-1",
              obligationKind: "ap_invoice",
              debtorEntityId: "org-a",
              creditorEntityId: "vendor-1",
              beneficialOwnerType: null,
              beneficialOwnerId: null,
              assetId: "asset-usd",
              amountMinor: "1000",
              settledMinor: "0",
              dueAt: null,
              memo: null,
              payload: null,
              createdAt: new Date("2026-03-27T10:00:00.000Z"),
              updatedAt: new Date("2026-03-27T10:00:00.000Z"),
            })),
          },
        },
      })) as any,
      createTreasuryReads: vi.fn(() => ({
        findTreasuryAccount: vi.fn(async (id: string) => ({
          id,
          ownerEntityId: "org-a",
        })),
        findInstruction: vi.fn(),
        listInstructionEvents: vi.fn(),
      })),
      createAccountingModule: vi.fn(() => ({
        packs: {
          queries: {
            resolvePostingPlan,
          },
        },
      })) as any,
      createLedgerModule: vi.fn(() => ({
        books: {
          commands: {
            ensureDefaultOrganizationBook: vi.fn(async () => ({
              bookId: "book-a",
            })),
          },
        },
        operations: {
          commands: {
            commit,
          },
        },
      })) as any,
    });

    await expect(
      workflow.openObligation({
        obligationKind: "ap_invoice",
        debtorEntityId: "org-a",
        creditorEntityId: "vendor-1",
        beneficialOwnerType: null,
        beneficialOwnerId: null,
        assetId: "asset-usd",
        amountMinor: "1000",
        dueAt: null,
        memo: null,
        payload: null,
      }),
    ).rejects.toThrow("ledger failed");
  });
});
