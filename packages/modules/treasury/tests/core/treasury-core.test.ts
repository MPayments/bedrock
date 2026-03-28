import { createModuleRuntime } from "@bedrock/shared/core";

import { createTreasuryAccountsService } from "../../src/accounts/service";
import { createTreasuryAllocationsService } from "../../src/allocations/service";
import { createTreasuryExecutionsService } from "../../src/executions/service";
import { createTreasuryObligationsService } from "../../src/obligations/service";
import { createTreasuryOperationsService } from "../../src/operations/service";
import { createTreasuryPositionsService } from "../../src/positions/service";
import type {
  AllocationRecord,
  CounterpartyEndpointRecord,
  ExecutionEventRecord,
  ExecutionInstructionRecord,
  ObligationRecord,
  TreasuryAccountBalanceEntryRecord,
  TreasuryAccountBalanceRow,
  TreasuryAccountRecord,
  TreasuryDocumentLinkRecord,
  TreasuryCoreTx,
  TreasuryCoreUnitOfWork,
  TreasuryEndpointRecord,
  TreasuryOperationObligationRecord,
  TreasuryOperationRecord,
  TreasuryPositionRecord,
  UnmatchedExternalRecordRow,
} from "../../src/shared/application/core-ports";

class InMemoryTreasuryStore implements TreasuryCoreTx, TreasuryCoreUnitOfWork {
  readonly accounts: TreasuryAccountRecord[] = [];
  readonly treasuryEndpoints: TreasuryEndpointRecord[] = [];
  readonly counterpartyEndpoints: CounterpartyEndpointRecord[] = [];
  readonly obligations: ObligationRecord[] = [];
  readonly operations: TreasuryOperationRecord[] = [];
  readonly operationLinks: TreasuryOperationObligationRecord[] = [];
  readonly instructions: ExecutionInstructionRecord[] = [];
  readonly events: ExecutionEventRecord[] = [];
  readonly allocations: AllocationRecord[] = [];
  readonly positions: TreasuryPositionRecord[] = [];
  readonly balanceEntries: TreasuryAccountBalanceEntryRecord[] = [];
  readonly documentLinks: TreasuryDocumentLinkRecord[] = [];
  readonly unmatchedExternalRecords: UnmatchedExternalRecordRow[] = [];

  constructor(private readonly getNow: () => Date) {}

  run<T>(work: (tx: TreasuryCoreTx) => Promise<T>): Promise<T> {
    return work(this);
  }

  async findTreasuryAccount(id: string) {
    return this.accounts.find((row) => row.id === id) ?? null;
  }

  async findTreasuryEndpoint(id: string) {
    return this.treasuryEndpoints.find((row) => row.id === id) ?? null;
  }

  async findCounterpartyEndpoint(id: string) {
    return this.counterpartyEndpoints.find((row) => row.id === id) ?? null;
  }

  async findObligation(id: string) {
    return this.obligations.find((row) => row.id === id) ?? null;
  }

  async findOperation(id: string) {
    return this.operations.find((row) => row.id === id) ?? null;
  }

  async findOperationByIdempotencyKey(idempotencyKey: string) {
    return this.operations.find((row) => row.idempotencyKey === idempotencyKey) ?? null;
  }

  async findInstruction(id: string) {
    return this.instructions.find((row) => row.id === id) ?? null;
  }

  async findExecutionEvent(id: string) {
    return this.events.find((row) => row.id === id) ?? null;
  }

  async findPosition(id: string) {
    return this.positions.find((row) => row.id === id) ?? null;
  }

  async listDocumentLinks(documentId: string) {
    return this.documentLinks.filter((row) => row.documentId === documentId);
  }

  async listOperationObligationLinks(operationId: string) {
    return this.operationLinks.filter((row) => row.operationId === operationId);
  }

  async listOperationInstructions(operationId: string) {
    return this.instructions.filter((row) => row.operationId === operationId);
  }

  async listInstructionEvents(instructionId: string) {
    return this.events.filter((row) => row.instructionId === instructionId);
  }

  async listOperationEvents(operationId: string) {
    const instructionIds = new Set(
      this.instructions
        .filter((row) => row.operationId === operationId)
        .map((row) => row.id),
    );
    return this.events.filter((row) => instructionIds.has(row.instructionId));
  }

  async listExecutionAllocations(executionEventId: string) {
    return this.allocations.filter((row) => row.executionEventId === executionEventId);
  }

  async listObligationAllocations(obligationId: string) {
    return this.allocations.filter((row) => row.obligationId === obligationId);
  }

  async listTreasuryPositions(input?: {
    originOperationId?: string;
    ownerEntityId?: string;
    beneficialOwnerType?: TreasuryPositionRecord["beneficialOwnerType"];
    beneficialOwnerId?: string;
  }) {
    return this.positions.filter((row) => {
      if (input?.originOperationId && row.originOperationId !== input.originOperationId) {
        return false;
      }
      if (input?.ownerEntityId && row.ownerEntityId !== input.ownerEntityId) {
        return false;
      }
      if (
        input?.beneficialOwnerType &&
        row.beneficialOwnerType !== input.beneficialOwnerType
      ) {
        return false;
      }
      if (input?.beneficialOwnerId && row.beneficialOwnerId !== input.beneficialOwnerId) {
        return false;
      }
      return true;
    });
  }

  async listTreasuryAccountBalances(accountIds?: string[]) {
    const rows = new Map<string, TreasuryAccountBalanceRow>();

    for (const entry of this.balanceEntries) {
      if (accountIds && accountIds.length > 0 && !accountIds.includes(entry.accountId)) {
        continue;
      }

      const key = `${entry.accountId}:${entry.assetId}`;
      const row = rows.get(key) ?? {
        accountId: entry.accountId,
        assetId: entry.assetId,
        pendingMinor: 0n,
        reservedMinor: 0n,
        bookedMinor: 0n,
      };

      if (entry.balanceState === "pending") {
        row.pendingMinor += entry.amountMinor;
      } else if (entry.balanceState === "reserved") {
        row.reservedMinor += entry.amountMinor;
      } else {
        row.bookedMinor += entry.amountMinor;
      }

      rows.set(key, row);
    }

    return [...rows.values()];
  }

  async listUnmatchedExternalRecords() {
    return [...this.unmatchedExternalRecords];
  }

  async insertTreasuryAccount(input: Omit<TreasuryAccountRecord, "createdAt" | "updatedAt">) {
    const row: TreasuryAccountRecord = {
      ...input,
      createdAt: this.getNow(),
      updatedAt: this.getNow(),
    };
    this.accounts.push(row);
    return row;
  }

  async insertTreasuryEndpoint(input: Omit<TreasuryEndpointRecord, "createdAt" | "updatedAt">) {
    const row: TreasuryEndpointRecord = {
      ...input,
      createdAt: this.getNow(),
      updatedAt: this.getNow(),
    };
    this.treasuryEndpoints.push(row);
    return row;
  }

  async insertCounterpartyEndpoint(
    input: Omit<CounterpartyEndpointRecord, "createdAt" | "updatedAt">,
  ) {
    const row: CounterpartyEndpointRecord = {
      ...input,
      createdAt: this.getNow(),
      updatedAt: this.getNow(),
    };
    this.counterpartyEndpoints.push(row);
    return row;
  }

  async insertObligation(input: Omit<ObligationRecord, "createdAt" | "updatedAt" | "settledMinor">) {
    const row: ObligationRecord = {
      ...input,
      settledMinor: 0n,
      createdAt: this.getNow(),
      updatedAt: this.getNow(),
    };
    this.obligations.push(row);
    return row;
  }

  async updateObligation(input: Pick<ObligationRecord, "id" | "settledMinor" | "updatedAt">) {
    const row = this.obligations.find((item) => item.id === input.id);
    if (row) {
      row.settledMinor = input.settledMinor;
      row.updatedAt = input.updatedAt;
    }
  }

  async insertOperation(
    input: Omit<TreasuryOperationRecord, "createdAt" | "updatedAt" | "approvedAt" | "reservedAt">,
  ) {
    const row: TreasuryOperationRecord = {
      ...input,
      createdAt: this.getNow(),
      updatedAt: this.getNow(),
      approvedAt: null,
      reservedAt: null,
    };
    this.operations.push(row);
    return row;
  }

  async updateOperationStatus(input: {
    id: string;
    instructionStatus: TreasuryOperationRecord["instructionStatus"];
    updatedAt: Date;
    approvedAt?: Date | null;
    reservedAt?: Date | null;
  }) {
    const row = this.operations.find((item) => item.id === input.id);
    if (row) {
      row.instructionStatus = input.instructionStatus;
      row.updatedAt = input.updatedAt;
      row.approvedAt = input.approvedAt ?? row.approvedAt;
      row.reservedAt = input.reservedAt ?? row.reservedAt;
    }
  }

  async insertOperationObligationLinks(
    links: Omit<TreasuryOperationObligationRecord, "createdAt">[],
  ) {
    for (const link of links) {
      this.operationLinks.push({ ...link, createdAt: this.getNow() });
    }
  }

  async insertExecutionInstruction(
    input: Omit<ExecutionInstructionRecord, "createdAt" | "updatedAt">,
  ) {
    const row: ExecutionInstructionRecord = {
      ...input,
      createdAt: this.getNow(),
      updatedAt: this.getNow(),
    };
    this.instructions.push(row);
    return row;
  }

  async updateExecutionInstructionStatus(input: {
    id: string;
    instructionStatus: ExecutionInstructionRecord["instructionStatus"];
    updatedAt: Date;
  }) {
    const row = this.instructions.find((item) => item.id === input.id);
    if (row) {
      row.instructionStatus = input.instructionStatus;
      row.updatedAt = input.updatedAt;
    }
  }

  async insertExecutionEvent(input: Omit<ExecutionEventRecord, "createdAt">) {
    const row: ExecutionEventRecord = {
      ...input,
      createdAt: this.getNow(),
    };
    this.events.push(row);
    return row;
  }

  async insertAllocation(input: Omit<AllocationRecord, "createdAt">) {
    const row: AllocationRecord = {
      ...input,
      createdAt: this.getNow(),
    };
    this.allocations.push(row);
    return row;
  }

  async insertPosition(
    input: Omit<TreasuryPositionRecord, "createdAt" | "updatedAt" | "closedAt" | "settledMinor">,
  ) {
    const row: TreasuryPositionRecord = {
      ...input,
      settledMinor: 0n,
      createdAt: this.getNow(),
      updatedAt: this.getNow(),
      closedAt: null,
    };
    this.positions.push(row);
    return row;
  }

  async updatePosition(input: {
    id: string;
    amountMinor?: bigint;
    settledMinor?: bigint;
    updatedAt: Date;
    closedAt?: Date | null;
  }) {
    const row = this.positions.find((item) => item.id === input.id);
    if (row) {
      row.amountMinor = input.amountMinor ?? row.amountMinor;
      row.settledMinor = input.settledMinor ?? row.settledMinor;
      row.updatedAt = input.updatedAt;
      row.closedAt = input.closedAt ?? row.closedAt;
    }
  }

  async findOpenPositionByKey(input: {
    positionKind: TreasuryPositionRecord["positionKind"];
    ownerEntityId: string;
    counterpartyEntityId: string | null;
    beneficialOwnerType: TreasuryPositionRecord["beneficialOwnerType"];
    beneficialOwnerId: string | null;
    assetId: string;
  }) {
    return (
      this.positions.find(
        (row) =>
          row.closedAt === null &&
          row.positionKind === input.positionKind &&
          row.ownerEntityId === input.ownerEntityId &&
          row.counterpartyEntityId === input.counterpartyEntityId &&
          row.beneficialOwnerType === input.beneficialOwnerType &&
          row.beneficialOwnerId === input.beneficialOwnerId &&
          row.assetId === input.assetId,
      ) ?? null
    );
  }

  async findOpenPositionByOrigin(input: {
    originOperationId: string;
    positionKind: TreasuryPositionRecord["positionKind"];
    ownerEntityId: string;
  }) {
    return (
      this.positions.find(
        (row) =>
          row.closedAt === null &&
          row.originOperationId === input.originOperationId &&
          row.positionKind === input.positionKind &&
          row.ownerEntityId === input.ownerEntityId,
      ) ?? null
    );
  }

  async insertAccountBalanceEntries(
    entries: Omit<TreasuryAccountBalanceEntryRecord, "createdAt">[],
  ) {
    for (const entry of entries) {
      this.balanceEntries.push({ ...entry, createdAt: this.getNow() });
    }
  }

  async insertDocumentLinks(
    links: Omit<TreasuryDocumentLinkRecord, "createdAt" | "id">[],
  ) {
    for (const link of links) {
      this.documentLinks.push({
        ...link,
        id: `doc-link-${this.documentLinks.length + 1}`,
        createdAt: this.getNow(),
      });
    }
  }

  async resolveOpenExceptionsForExternalRecord(input: {
    externalRecordId: string;
    resolvedAt: Date;
  }) {
    void input.resolvedAt;
    const next = this.unmatchedExternalRecords.filter(
      (row) => row.externalRecordId !== input.externalRecordId,
    );
    this.unmatchedExternalRecords.splice(0, this.unmatchedExternalRecords.length, ...next);
  }
}

function createCoreServices() {
  let seq = 1;
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 2, 27, 12, 0, tick++));
  const runtime = createModuleRuntime({
    service: "treasury.test",
    now,
    generateUuid: () => `00000000-0000-4000-8000-${String(seq++).padStart(12, "0")}`,
  });
  const store = new InMemoryTreasuryStore(now);
  const deps = {
    reads: store,
    runtime,
    unitOfWork: store,
  };

  return {
    store,
    accounts: createTreasuryAccountsService(deps),
    allocations: createTreasuryAllocationsService(deps),
    executions: createTreasuryExecutionsService(deps),
    obligations: createTreasuryObligationsService(deps),
    operations: createTreasuryOperationsService(deps),
    positions: createTreasuryPositionsService(deps),
  };
}

describe("canonical treasury core", () => {
  it("rejects legacy and ambiguous operation taxonomy", async () => {
    const { operations } = createCoreServices();

    await expect(
      operations.commands.issueOperation({
        operationKind: "transit",
        idempotencyKey: "legacy",
        economicOwnerEntityId: "00000000-0000-4000-8000-000000000001",
        executingEntityId: "00000000-0000-4000-8000-000000000001",
        sourceAccountId: "00000000-0000-4000-8000-000000000010",
        assetId: "00000000-0000-4000-8000-000000000020",
        amountMinor: "100",
      } as never),
    ).rejects.toThrow();
  });

  it("settles a POBO payout through operations, instructions, events, allocations, and mirrored intercompany positions", async () => {
    const { accounts, obligations, operations, executions, allocations, positions, store } =
      createCoreServices();

    const sourceAccount = await accounts.commands.createTreasuryAccount({
      kind: "bank",
      ownerEntityId: "00000000-0000-4000-8000-000000000100",
      operatorEntityId: "00000000-0000-4000-8000-000000000100",
      assetId: "00000000-0000-4000-8000-000000000200",
      provider: "bank",
      networkOrRail: "swift",
      accountReference: "BANK-TREASURY-1",
      reconciliationMode: "manual",
      finalityModel: "booked",
      segregationModel: null,
      canReceive: true,
      canSend: true,
      metadata: null,
    });
    const beneficiary = await accounts.commands.createCounterpartyEndpoint({
      counterpartyId: "00000000-0000-4000-8000-000000000300",
      assetId: sourceAccount.assetId,
      endpointType: "iban",
      value: "DE12500105170648489890",
      label: null,
      memoTag: null,
      metadata: null,
    });
    const obligation = await obligations.commands.openObligation({
      obligationKind: "ap_invoice",
      debtorEntityId: "00000000-0000-4000-8000-000000000111",
      creditorEntityId: "00000000-0000-4000-8000-000000000300",
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      assetId: sourceAccount.assetId,
      amountMinor: "1000",
      dueAt: null,
      memo: "vendor invoice",
      payload: null,
    });

    const operation = await operations.commands.issueOperation({
      operationKind: "payout",
      idempotencyKey: "pobo-payout",
      economicOwnerEntityId: "00000000-0000-4000-8000-000000000111",
      executingEntityId: "00000000-0000-4000-8000-000000000100",
      sourceAccountId: sourceAccount.id,
      assetId: sourceAccount.assetId,
      amountMinor: "1000",
      obligationIds: [obligation.id],
      memo: null,
    });
    expect(operation.settlementModel).toBe("pobo");

    await operations.commands.approveOperation({ operationId: operation.id });
    await operations.commands.reserveOperationFunds({ operationId: operation.id });

    const instruction = await executions.commands.createExecutionInstruction({
      operationId: operation.id,
      destinationEndpointId: beneficiary.id,
    });
    const recorded = await executions.commands.recordExecutionEvent({
      instructionId: instruction.id,
      eventKind: "settled",
    });

    expect(recorded.operation.instructionStatus).toBe("settled");

    const settledEvent = store.events.at(-1);
    expect(settledEvent?.eventKind).toBe("settled");

    const allocation = await allocations.commands.allocateExecution({
      obligationId: obligation.id,
      executionEventId: settledEvent!.id,
      allocatedMinor: "1000",
      allocationType: "principal",
    });

    expect(allocation.obligation.settledMinor).toBe("1000");

    const operationPositions = await positions.queries.listTreasuryPositions({
      originOperationId: operation.id,
    });
    expect(operationPositions.map((row) => row.positionKind).sort()).toEqual([
      "intercompany_due_from",
      "intercompany_due_to",
    ]);

    const balances = await accounts.queries.getTreasuryAccountBalances({
      accountIds: [sourceAccount.id],
    });
    expect(balances.data[0]).toMatchObject({
      accountId: sourceAccount.id,
      bookedMinor: "-1000",
      reservedMinor: "0",
    });
  });

  it("creates customer-liability and ROBO positions for inbound collections", async () => {
    const { accounts, operations, executions, positions } = createCoreServices();

    const receivingAccount = await accounts.commands.createTreasuryAccount({
      kind: "bank",
      ownerEntityId: "00000000-0000-4000-8000-000000000400",
      operatorEntityId: "00000000-0000-4000-8000-000000000400",
      assetId: "00000000-0000-4000-8000-000000000500",
      provider: "bank",
      networkOrRail: "sepa",
      accountReference: "BANK-COLLECTION-1",
      reconciliationMode: "manual",
      finalityModel: "booked",
      segregationModel: null,
      canReceive: true,
      canSend: true,
      metadata: null,
    });

    const operation = await operations.commands.issueOperation({
      operationKind: "collection",
      idempotencyKey: "robo-collection",
      economicOwnerEntityId: "00000000-0000-4000-8000-000000000401",
      executingEntityId: "00000000-0000-4000-8000-000000000400",
      cashHolderEntityId: "00000000-0000-4000-8000-000000000400",
      beneficialOwnerType: "customer",
      beneficialOwnerId: "00000000-0000-4000-8000-000000000499",
      sourceAccountId: receivingAccount.id,
      assetId: receivingAccount.assetId,
      amountMinor: "2500",
      obligationIds: [],
      memo: null,
    });

    expect(operation.settlementModel).toBe("robo");

    await operations.commands.approveOperation({ operationId: operation.id });
    const instruction = await executions.commands.createExecutionInstruction({
      operationId: operation.id,
    });
    await executions.commands.recordExecutionEvent({
      instructionId: instruction.id,
      eventKind: "settled",
    });

    const operationPositions = await positions.queries.listTreasuryPositions({
      originOperationId: operation.id,
    });
    expect(operationPositions.map((row) => row.positionKind).sort()).toEqual([
      "customer_liability",
      "intercompany_due_from",
      "intercompany_due_to",
    ]);
  });

  it("resolves unmatched external evidence when an execution event references the external record", async () => {
    const { accounts, operations, executions, store } = createCoreServices();

    const sourceAccount = await accounts.commands.createTreasuryAccount({
      kind: "bank",
      ownerEntityId: "00000000-0000-4000-8000-000000000710",
      operatorEntityId: "00000000-0000-4000-8000-000000000710",
      assetId: "00000000-0000-4000-8000-000000000720",
      provider: "bank",
      networkOrRail: "sepa",
      accountReference: "BANK-UNMATCHED-1",
      reconciliationMode: "manual",
      finalityModel: "booked",
      segregationModel: null,
      canReceive: true,
      canSend: true,
      metadata: null,
    });

    store.unmatchedExternalRecords.push({
      externalRecordId: "00000000-0000-4000-8000-000000000799",
      source: "reconciliation",
      sourceRecordId: "stmt-line-1",
      recordKind: "statement_line",
      receivedAt: new Date("2026-03-27T12:05:00.000Z"),
      reasonCode: "unmatched_external_record",
      reasonMeta: null,
    });

    const operation = await operations.commands.issueOperation({
      operationKind: "payout",
      idempotencyKey: "manual-evidence-resolution",
      economicOwnerEntityId: "00000000-0000-4000-8000-000000000710",
      executingEntityId: "00000000-0000-4000-8000-000000000710",
      sourceAccountId: sourceAccount.id,
      assetId: sourceAccount.assetId,
      amountMinor: "100",
      obligationIds: [],
      memo: null,
    });

    await operations.commands.approveOperation({ operationId: operation.id });
    const instruction = await executions.commands.createExecutionInstruction({
      operationId: operation.id,
    });

    expect(
      await executions.queries.listUnmatchedExternalRecords({
        limit: 10,
      }),
    ).toHaveLength(1);

    await executions.commands.recordExecutionEvent({
      instructionId: instruction.id,
      eventKind: "settled",
      externalRecordId: "00000000-0000-4000-8000-000000000799",
    });

    expect(
      await executions.queries.listUnmatchedExternalRecords({
        limit: 10,
      }),
    ).toHaveLength(0);
  });

  it("marks voided operations as terminal and rejects further lifecycle events", async () => {
    const { accounts, operations, executions, store } = createCoreServices();

    const sourceAccount = await accounts.commands.createTreasuryAccount({
      kind: "bank",
      ownerEntityId: "00000000-0000-4000-8000-000000000810",
      operatorEntityId: "00000000-0000-4000-8000-000000000810",
      assetId: "00000000-0000-4000-8000-000000000820",
      provider: "bank",
      networkOrRail: "swift",
      accountReference: "BANK-VOID-1",
      reconciliationMode: "manual",
      finalityModel: "booked",
      segregationModel: null,
      canReceive: true,
      canSend: true,
      metadata: null,
    });

    const operation = await operations.commands.issueOperation({
      operationKind: "payout",
      idempotencyKey: "voided-operation",
      economicOwnerEntityId: "00000000-0000-4000-8000-000000000810",
      executingEntityId: "00000000-0000-4000-8000-000000000810",
      sourceAccountId: sourceAccount.id,
      assetId: sourceAccount.assetId,
      amountMinor: "100",
      obligationIds: [],
      memo: null,
    });

    await operations.commands.approveOperation({ operationId: operation.id });

    const instruction = await executions.commands.createExecutionInstruction({
      operationId: operation.id,
    });

    const voided = await executions.commands.recordExecutionEvent({
      instructionId: instruction.id,
      eventKind: "voided",
    });

    expect(voided.operation.instructionStatus).toBe("void");
    expect(store.operations.find((item) => item.id === operation.id)?.instructionStatus).toBe(
      "void",
    );

    await expect(
      executions.commands.recordExecutionEvent({
        instructionId: instruction.id,
        eventKind: "settled",
      }),
    ).rejects.toThrow();
  });

  it("still allows manual adjustment after an instruction is voided", async () => {
    const { accounts, operations, executions } = createCoreServices();

    const sourceAccount = await accounts.commands.createTreasuryAccount({
      kind: "bank",
      ownerEntityId: "00000000-0000-4000-8000-000000000830",
      operatorEntityId: "00000000-0000-4000-8000-000000000830",
      assetId: "00000000-0000-4000-8000-000000000840",
      provider: "bank",
      networkOrRail: "swift",
      accountReference: "BANK-ADJUST-1",
      reconciliationMode: "manual",
      finalityModel: "booked",
      segregationModel: null,
      canReceive: true,
      canSend: true,
      metadata: null,
    });

    const operation = await operations.commands.issueOperation({
      operationKind: "payout",
      idempotencyKey: "voided-adjustment",
      economicOwnerEntityId: "00000000-0000-4000-8000-000000000830",
      executingEntityId: "00000000-0000-4000-8000-000000000830",
      sourceAccountId: sourceAccount.id,
      assetId: sourceAccount.assetId,
      amountMinor: "100",
      obligationIds: [],
      memo: null,
    });

    await operations.commands.approveOperation({ operationId: operation.id });

    const instruction = await executions.commands.createExecutionInstruction({
      operationId: operation.id,
    });

    await executions.commands.recordExecutionEvent({
      instructionId: instruction.id,
      eventKind: "voided",
    });

    const adjustment = await executions.commands.recordExecutionEvent({
      instructionId: instruction.id,
      eventKind: "manual_adjustment",
    });

    expect(adjustment.operation.instructionStatus).toBe("void");
    expect(adjustment.event.eventKind).toBe("manual_adjustment");
  });

  it("enforces same-entity rules for intracompany transfers", async () => {
    const { accounts, operations, positions } = createCoreServices();

    const source = await accounts.commands.createTreasuryAccount({
      kind: "bank",
      ownerEntityId: "00000000-0000-4000-8000-000000000600",
      operatorEntityId: "00000000-0000-4000-8000-000000000600",
      assetId: "00000000-0000-4000-8000-000000000700",
      provider: "bank",
      networkOrRail: "ach",
      accountReference: "BANK-OPS-1",
      reconciliationMode: "manual",
      finalityModel: "booked",
      segregationModel: null,
      canReceive: true,
      canSend: true,
      metadata: null,
    });
    const destination = await accounts.commands.createTreasuryAccount({
      kind: "bank",
      ownerEntityId: "00000000-0000-4000-8000-000000000600",
      operatorEntityId: "00000000-0000-4000-8000-000000000600",
      assetId: "00000000-0000-4000-8000-000000000700",
      provider: "bank",
      networkOrRail: "ach",
      accountReference: "BANK-OPS-2",
      reconciliationMode: "manual",
      finalityModel: "booked",
      segregationModel: null,
      canReceive: true,
      canSend: true,
      metadata: null,
    });

    await expect(
      operations.commands.issueOperation({
        operationKind: "intracompany_transfer",
        idempotencyKey: "bad-transfer",
        economicOwnerEntityId: "00000000-0000-4000-8000-000000000601",
        executingEntityId: "00000000-0000-4000-8000-000000000600",
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        assetId: source.assetId,
        amountMinor: "10",
        obligationIds: [],
        memo: null,
      }),
    ).rejects.toThrow();

    const listed = await positions.queries.listTreasuryPositions();
    expect(listed).toEqual([]);
  });
});
