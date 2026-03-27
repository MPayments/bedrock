import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TreasuryConflictError } from "@bedrock/treasury";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  default: {
    api: {
      userHasPermission,
    },
  },
}));

import { treasuryRoutes } from "../../src/routes/treasury";

function createTreasuryModuleStub() {
  return {
    accounts: {
      commands: {
        createTreasuryAccount: vi.fn(),
        createTreasuryEndpoint: vi.fn(),
        createCounterpartyEndpoint: vi.fn(),
      },
      queries: {
        listCounterpartyEndpoints: vi.fn(),
        listTreasuryEndpoints: vi.fn(),
        listTreasuryAccounts: vi.fn(),
        getTreasuryAccountBalances: vi.fn(),
      },
    },
    obligations: {
      commands: {
        openObligation: vi.fn(),
      },
      queries: {
        getObligationOutstanding: vi.fn(),
      },
    },
    operations: {
      commands: {
        issueOperation: vi.fn(),
        approveOperation: vi.fn(),
        reserveOperationFunds: vi.fn(),
      },
      queries: {
        listTreasuryOperations: vi.fn(),
        getOperationTimeline: vi.fn(),
      },
    },
    executions: {
      commands: {
        createExecutionInstruction: vi.fn(),
        recordExecutionEvent: vi.fn(),
      },
      queries: {
        listExecutionInstructions: vi.fn(),
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
        settlePosition: vi.fn(),
      },
      queries: {
        listTreasuryPositions: vi.fn(),
      },
    },
  };
}

function createTestApp() {
  const treasuryModule = createTreasuryModuleStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    await next();
  });
  app.route("/", treasuryRoutes({ treasuryModule } as any));

  return { app, treasuryModule };
}

describe("treasuryRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("routes account creation commands", async () => {
    const { app, treasuryModule } = createTestApp();
    treasuryModule.accounts.commands.createTreasuryAccount.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      kind: "bank",
      ownerEntityId: "22222222-2222-4222-8222-222222222222",
      operatorEntityId: "22222222-2222-4222-8222-222222222222",
      assetId: "33333333-3333-4333-8333-333333333333",
      provider: "provider",
      networkOrRail: "SEPA",
      accountReference: "ref-1",
      reconciliationMode: null,
      finalityModel: null,
      segregationModel: null,
      canReceive: true,
      canSend: true,
      metadata: null,
      createdAt: new Date("2026-03-27T10:00:00.000Z"),
      updatedAt: new Date("2026-03-27T10:00:00.000Z"),
      archivedAt: null,
    });
    treasuryModule.accounts.commands.createTreasuryEndpoint.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      accountId: "11111111-1111-4111-8111-111111111111",
      endpointType: "iban",
      value: "DE123",
      label: null,
      memoTag: null,
      metadata: null,
      createdAt: new Date("2026-03-27T10:00:00.000Z"),
      updatedAt: new Date("2026-03-27T10:00:00.000Z"),
      archivedAt: null,
    });
    treasuryModule.accounts.commands.createCounterpartyEndpoint.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      counterpartyId: "66666666-6666-4666-8666-666666666666",
      assetId: "33333333-3333-4333-8333-333333333333",
      endpointType: "iban",
      value: "DE999",
      label: null,
      memoTag: null,
      metadata: null,
      createdAt: new Date("2026-03-27T10:00:00.000Z"),
      updatedAt: new Date("2026-03-27T10:00:00.000Z"),
      archivedAt: null,
    });

    const accountResponse = await app.request("http://localhost/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "bank",
        ownerEntityId: "22222222-2222-4222-8222-222222222222",
        operatorEntityId: "22222222-2222-4222-8222-222222222222",
        assetId: "33333333-3333-4333-8333-333333333333",
        provider: "provider",
        networkOrRail: "SEPA",
        accountReference: "ref-1",
        reconciliationMode: null,
        finalityModel: null,
        segregationModel: null,
        canReceive: true,
        canSend: true,
        metadata: null,
      }),
    });
    const treasuryEndpointResponse = await app.request(
      "http://localhost/accounts/endpoints",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: "11111111-1111-4111-8111-111111111111",
          endpointType: "iban",
          value: "DE123",
          label: null,
          memoTag: null,
          metadata: null,
        }),
      },
    );
    const counterpartyEndpointResponse = await app.request(
      "http://localhost/counterparty-endpoints",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          counterpartyId: "66666666-6666-4666-8666-666666666666",
          assetId: "33333333-3333-4333-8333-333333333333",
          endpointType: "iban",
          value: "DE999",
          label: null,
          memoTag: null,
          metadata: null,
        }),
      },
    );

    expect(accountResponse.status).toBe(201);
    expect(treasuryEndpointResponse.status).toBe(201);
    expect(counterpartyEndpointResponse.status).toBe(201);
    expect(
      treasuryModule.accounts.commands.createTreasuryAccount,
    ).toHaveBeenCalledOnce();
    expect(
      treasuryModule.accounts.commands.createTreasuryEndpoint,
    ).toHaveBeenCalledOnce();
    expect(
      treasuryModule.accounts.commands.createCounterpartyEndpoint,
    ).toHaveBeenCalledOnce();
  });

  it("routes treasury list and detail queries", async () => {
    const { app, treasuryModule } = createTestApp();
    treasuryModule.accounts.queries.listTreasuryAccounts.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "bank",
        ownerEntityId: "22222222-2222-4222-8222-222222222222",
        operatorEntityId: "22222222-2222-4222-8222-222222222222",
        assetId: "33333333-3333-4333-8333-333333333333",
        provider: "provider",
        networkOrRail: "SEPA",
        accountReference: "ref-1",
        reconciliationMode: null,
        finalityModel: null,
        segregationModel: null,
        canReceive: true,
        canSend: true,
        metadata: null,
        createdAt: new Date("2026-03-27T10:00:00.000Z"),
        updatedAt: new Date("2026-03-27T10:00:00.000Z"),
        archivedAt: null,
      },
    ]);
    treasuryModule.accounts.queries.listTreasuryEndpoints.mockResolvedValue([
      {
        id: "44444444-4444-4444-8444-444444444444",
        accountId: "11111111-1111-4111-8111-111111111111",
        endpointType: "iban",
        value: "DE123",
        label: null,
        memoTag: null,
        metadata: null,
        createdAt: new Date("2026-03-27T10:00:00.000Z"),
        updatedAt: new Date("2026-03-27T10:00:00.000Z"),
        archivedAt: null,
      },
    ]);
    treasuryModule.accounts.queries.listCounterpartyEndpoints.mockResolvedValue([
      {
        id: "55555555-5555-4555-8555-555555555555",
        counterpartyId: "66666666-6666-4666-8666-666666666666",
        assetId: "33333333-3333-4333-8333-333333333333",
        endpointType: "iban",
        value: "DE999",
        label: null,
        memoTag: null,
        metadata: null,
        createdAt: new Date("2026-03-27T10:00:00.000Z"),
        updatedAt: new Date("2026-03-27T10:00:00.000Z"),
        archivedAt: null,
      },
    ]);
    treasuryModule.accounts.queries.getTreasuryAccountBalances.mockResolvedValue([
      {
        accountId: "11111111-1111-4111-8111-111111111111",
        assetId: "33333333-3333-4333-8333-333333333333",
        pendingMinor: "0",
        reservedMinor: "10",
        bookedMinor: "90",
        availableMinor: "80",
      },
    ]);
    treasuryModule.obligations.queries.getObligationOutstanding.mockResolvedValue({
      obligationId: "77777777-7777-4777-8777-777777777777",
      obligationKind: "ap_invoice",
      assetId: "33333333-3333-4333-8333-333333333333",
      amountMinor: "100",
      settledMinor: "40",
      outstandingMinor: "60",
    });
    treasuryModule.operations.queries.listTreasuryOperations.mockResolvedValue([
      {
        id: "88888888-8888-4888-8888-888888888888",
        idempotencyKey: "idem-1",
        operationKind: "payout",
        economicOwnerEntityId: "22222222-2222-4222-8222-222222222222",
        executingEntityId: "22222222-2222-4222-8222-222222222222",
        cashHolderEntityId: null,
        beneficialOwnerType: null,
        beneficialOwnerId: null,
        legalBasis: null,
        settlementModel: "direct",
        instructionStatus: "reserved",
        sourceAccountId: "11111111-1111-4111-8111-111111111111",
        destinationAccountId: null,
        sourceAssetId: "33333333-3333-4333-8333-333333333333",
        destinationAssetId: null,
        sourceAmountMinor: "100",
        destinationAmountMinor: null,
        memo: null,
        payload: null,
        createdAt: new Date("2026-03-27T10:00:00.000Z"),
        updatedAt: new Date("2026-03-27T10:00:00.000Z"),
        approvedAt: null,
        reservedAt: null,
      },
    ]);
    treasuryModule.operations.queries.getOperationTimeline.mockResolvedValue({
      operation: {
        id: "88888888-8888-4888-8888-888888888888",
        idempotencyKey: "idem-1",
        operationKind: "payout",
        economicOwnerEntityId: "22222222-2222-4222-8222-222222222222",
        executingEntityId: "22222222-2222-4222-8222-222222222222",
        cashHolderEntityId: null,
        beneficialOwnerType: null,
        beneficialOwnerId: null,
        legalBasis: null,
        settlementModel: "direct",
        instructionStatus: "reserved",
        sourceAccountId: "11111111-1111-4111-8111-111111111111",
        destinationAccountId: null,
        sourceAssetId: "33333333-3333-4333-8333-333333333333",
        destinationAssetId: null,
        sourceAmountMinor: "100",
        destinationAmountMinor: null,
        memo: null,
        payload: null,
        createdAt: new Date("2026-03-27T10:00:00.000Z"),
        updatedAt: new Date("2026-03-27T10:00:00.000Z"),
        approvedAt: null,
        reservedAt: null,
      },
      obligations: [],
      obligationItems: [],
      instructions: [],
      instructionItems: [],
      events: [],
      eventItems: [],
      positions: [],
      positionItems: [],
    });
    treasuryModule.executions.queries.listUnmatchedExternalRecords.mockResolvedValue([
      {
        externalRecordId: "99999999-9999-4999-8999-999999999999",
        source: "manual",
        sourceRecordId: "statement-1",
        recordKind: "statement_line",
        receivedAt: new Date("2026-03-27T10:00:00.000Z"),
        reasonCode: "no_match",
        reasonMeta: null,
      },
    ]);
    treasuryModule.executions.queries.listExecutionInstructions.mockResolvedValue([
      {
        id: "12121212-1212-4121-8121-121212121212",
        operationId: "88888888-8888-4888-8888-888888888888",
        sourceAccountId: "11111111-1111-4111-8111-111111111111",
        destinationEndpointId: null,
        submissionChannel: "manual",
        instructionStatus: "reserved",
        assetId: "33333333-3333-4333-8333-333333333333",
        amountMinor: "100",
        metadata: null,
        createdAt: new Date("2026-03-27T10:00:00.000Z"),
        updatedAt: new Date("2026-03-27T10:00:00.000Z"),
      },
    ]);
    treasuryModule.positions.queries.listTreasuryPositions.mockResolvedValue([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        originOperationId: null,
        positionKind: "suspense",
        ownerEntityId: "22222222-2222-4222-8222-222222222222",
        counterpartyEntityId: null,
        beneficialOwnerType: null,
        beneficialOwnerId: null,
        assetId: "33333333-3333-4333-8333-333333333333",
        amountMinor: "100",
        settledMinor: "0",
        createdAt: new Date("2026-03-27T10:00:00.000Z"),
        updatedAt: new Date("2026-03-27T10:00:00.000Z"),
        closedAt: null,
      },
    ]);

    expect(await app.request("http://localhost/accounts")).toHaveProperty(
      "status",
      200,
    );
    expect(
      await app.request("http://localhost/accounts/endpoints"),
    ).toHaveProperty("status", 200);
    expect(
      await app.request("http://localhost/counterparty-endpoints"),
    ).toHaveProperty("status", 200);
    expect(await app.request("http://localhost/accounts/balances")).toHaveProperty(
      "status",
      200,
    );
    expect(
      await app.request(
        "http://localhost/obligations/77777777-7777-4777-8777-777777777777/outstanding",
      ),
    ).toHaveProperty("status", 200);
    expect(await app.request("http://localhost/operations")).toHaveProperty(
      "status",
      200,
    );
    expect(
      await app.request(
        "http://localhost/operations/88888888-8888-4888-8888-888888888888/timeline",
      ),
    ).toHaveProperty("status", 200);
    expect(
      await app.request("http://localhost/execution-instructions"),
    ).toHaveProperty("status", 200);
    expect(
      await app.request(
        "http://localhost/execution-events/unmatched?limit=10",
      ),
    ).toHaveProperty("status", 200);
    expect(await app.request("http://localhost/positions")).toHaveProperty(
      "status",
      200,
    );

    expect(treasuryModule.accounts.queries.listTreasuryAccounts).toHaveBeenCalledWith(
      {},
    );
    expect(
      treasuryModule.accounts.queries.listTreasuryEndpoints,
    ).toHaveBeenCalledWith({});
    expect(
      treasuryModule.accounts.queries.listCounterpartyEndpoints,
    ).toHaveBeenCalledWith({});
    expect(
      treasuryModule.accounts.queries.getTreasuryAccountBalances,
    ).toHaveBeenCalledWith({});
    expect(
      treasuryModule.obligations.queries.getObligationOutstanding,
    ).toHaveBeenCalledWith({
      obligationId: "77777777-7777-4777-8777-777777777777",
    });
    expect(
      treasuryModule.operations.queries.listTreasuryOperations,
    ).toHaveBeenCalledWith({});
    expect(
      treasuryModule.operations.queries.getOperationTimeline,
    ).toHaveBeenCalledWith({
      operationId: "88888888-8888-4888-8888-888888888888",
    });
    expect(
      treasuryModule.executions.queries.listExecutionInstructions,
    ).toHaveBeenCalledWith({});
    expect(
      treasuryModule.executions.queries.listUnmatchedExternalRecords,
    ).toHaveBeenCalledWith({
      limit: 10,
    });
    expect(
      treasuryModule.positions.queries.listTreasuryPositions,
    ).toHaveBeenCalledOnce();
  });

  it("routes obligation, operation, execution, allocation, and position commands", async () => {
    const { app, treasuryModule } = createTestApp();
    treasuryModule.obligations.commands.openObligation.mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
      obligationKind: "ap_invoice",
      debtorEntityId: "22222222-2222-4222-8222-222222222222",
      creditorEntityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      assetId: "33333333-3333-4333-8333-333333333333",
      amountMinor: "100",
      settledMinor: "0",
      dueAt: null,
      memo: null,
      payload: null,
      createdAt: new Date("2026-03-27T10:00:00.000Z"),
      updatedAt: new Date("2026-03-27T10:00:00.000Z"),
    });
    treasuryModule.operations.commands.issueOperation.mockResolvedValue({
      id: "88888888-8888-4888-8888-888888888888",
      idempotencyKey: "idem-1",
      operationKind: "payout",
      economicOwnerEntityId: "22222222-2222-4222-8222-222222222222",
      executingEntityId: "22222222-2222-4222-8222-222222222222",
      cashHolderEntityId: null,
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      legalBasis: null,
      settlementModel: "direct",
      instructionStatus: "draft",
      sourceAccountId: "11111111-1111-4111-8111-111111111111",
      destinationAccountId: null,
      sourceAssetId: "33333333-3333-4333-8333-333333333333",
      destinationAssetId: null,
      sourceAmountMinor: "100",
      destinationAmountMinor: null,
      memo: null,
      payload: null,
      createdAt: new Date("2026-03-27T10:00:00.000Z"),
      updatedAt: new Date("2026-03-27T10:00:00.000Z"),
      approvedAt: null,
      reservedAt: null,
    });
    treasuryModule.operations.commands.approveOperation.mockResolvedValue({
      id: "88888888-8888-4888-8888-888888888888",
    });
    treasuryModule.operations.commands.reserveOperationFunds.mockResolvedValue({
      id: "88888888-8888-4888-8888-888888888888",
    });
    treasuryModule.executions.commands.createExecutionInstruction.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      operationId: "88888888-8888-4888-8888-888888888888",
      sourceAccountId: "11111111-1111-4111-8111-111111111111",
      destinationEndpointId: null,
      submissionChannel: "manual",
      instructionStatus: "reserved",
      assetId: "33333333-3333-4333-8333-333333333333",
      amountMinor: "100",
      metadata: null,
      createdAt: new Date("2026-03-27T10:00:00.000Z"),
      updatedAt: new Date("2026-03-27T10:00:00.000Z"),
    });
    treasuryModule.executions.commands.recordExecutionEvent.mockResolvedValue({
      event: {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        instructionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        eventKind: "submitted",
        eventAt: new Date("2026-03-27T10:00:00.000Z"),
        externalRecordId: null,
        metadata: null,
        createdAt: new Date("2026-03-27T10:00:00.000Z"),
      },
      operation: {
        id: "88888888-8888-4888-8888-888888888888",
      },
    });
    treasuryModule.allocations.commands.allocateExecution.mockResolvedValue({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      obligationId: "77777777-7777-4777-8777-777777777777",
      executionEventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      allocatedMinor: "50",
      allocationType: "principal",
      createdAt: new Date("2026-03-27T10:00:00.000Z"),
    });
    treasuryModule.positions.commands.settlePosition.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      originOperationId: null,
      positionKind: "suspense",
      ownerEntityId: "22222222-2222-4222-8222-222222222222",
      counterpartyEntityId: null,
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      assetId: "33333333-3333-4333-8333-333333333333",
      amountMinor: "100",
      settledMinor: "100",
      createdAt: new Date("2026-03-27T10:00:00.000Z"),
      updatedAt: new Date("2026-03-27T10:00:00.000Z"),
      closedAt: new Date("2026-03-27T10:00:00.000Z"),
    });

    expect(
      await app.request("http://localhost/obligations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          obligationKind: "ap_invoice",
          debtorEntityId: "22222222-2222-4222-8222-222222222222",
          creditorEntityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          beneficialOwnerType: null,
          beneficialOwnerId: null,
          assetId: "33333333-3333-4333-8333-333333333333",
          amountMinor: "100",
          dueAt: null,
          memo: null,
          payload: null,
        }),
      }),
    ).toHaveProperty("status", 201);

    expect(
      await app.request("http://localhost/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationKind: "payout",
          idempotencyKey: "idem-1",
          economicOwnerEntityId: "22222222-2222-4222-8222-222222222222",
          executingEntityId: "22222222-2222-4222-8222-222222222222",
          obligationIds: [],
          sourceAccountId: "11111111-1111-4111-8111-111111111111",
          assetId: "33333333-3333-4333-8333-333333333333",
          amountMinor: "100",
          memo: null,
        }),
      }),
    ).toHaveProperty("status", 201);

    expect(
      await app.request(
        "http://localhost/operations/88888888-8888-4888-8888-888888888888/approve",
        { method: "POST" },
      ),
    ).toHaveProperty("status", 200);
    expect(
      await app.request(
        "http://localhost/operations/88888888-8888-4888-8888-888888888888/reserve",
        { method: "POST" },
      ),
    ).toHaveProperty("status", 200);
    expect(
      await app.request("http://localhost/execution-instructions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "88888888-8888-4888-8888-888888888888",
          destinationEndpointId: null,
          submissionChannel: "manual",
          metadata: null,
        }),
      }),
    ).toHaveProperty("status", 201);
    expect(
      await app.request("http://localhost/execution-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instructionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          eventKind: "submitted",
          externalRecordId: null,
          metadata: null,
        }),
      }),
    ).toHaveProperty("status", 201);
    expect(
      await app.request("http://localhost/allocations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          obligationId: "77777777-7777-4777-8777-777777777777",
          executionEventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          allocatedMinor: "50",
          allocationType: "principal",
        }),
      }),
    ).toHaveProperty("status", 201);
    expect(
      await app.request(
        "http://localhost/positions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/settle",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            amountMinor: "100",
          }),
        },
      ),
    ).toHaveProperty("status", 200);

    expect(
      treasuryModule.obligations.commands.openObligation,
    ).toHaveBeenCalledOnce();
    expect(
      treasuryModule.operations.commands.issueOperation,
    ).toHaveBeenCalledOnce();
    expect(
      treasuryModule.operations.commands.approveOperation,
    ).toHaveBeenCalledWith({
      operationId: "88888888-8888-4888-8888-888888888888",
    });
    expect(
      treasuryModule.operations.commands.reserveOperationFunds,
    ).toHaveBeenCalledWith({
      operationId: "88888888-8888-4888-8888-888888888888",
    });
    expect(
      treasuryModule.executions.commands.createExecutionInstruction,
    ).toHaveBeenCalledOnce();
    expect(
      treasuryModule.executions.commands.recordExecutionEvent,
    ).toHaveBeenCalledOnce();
    expect(
      treasuryModule.allocations.commands.allocateExecution,
    ).toHaveBeenCalledOnce();
    expect(
      treasuryModule.positions.commands.settlePosition,
    ).toHaveBeenCalledWith({
      positionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      amountMinor: "100",
    });
  });

  it("returns 409 for treasury conflicts", async () => {
    const { app, treasuryModule } = createTestApp();
    treasuryModule.operations.commands.issueOperation.mockRejectedValue(
      new TreasuryConflictError(
        "Treasury operation idempotency key already exists: idem-1",
      ),
    );

    const response = await app.request("http://localhost/operations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operationKind: "payout",
        idempotencyKey: "idem-1",
        economicOwnerEntityId: "22222222-2222-4222-8222-222222222222",
        executingEntityId: "22222222-2222-4222-8222-222222222222",
        obligationIds: [],
        sourceAccountId: "11111111-1111-4111-8111-111111111111",
        assetId: "33333333-3333-4333-8333-333333333333",
        amountMinor: "100",
        memo: null,
      }),
    });

    expect(response.status).toBe(409);
  });
});
