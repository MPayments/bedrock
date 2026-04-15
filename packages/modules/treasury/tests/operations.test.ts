import { describe, expect, it, vi } from "vitest";

import {
  CreatePlannedTreasuryOperationInputSchema,
  ListTreasuryExecutionFeesQuerySchema,
  RecordTreasuryExecutionFeeInputSchema,
  TreasuryOperationFactSourceKindSchema,
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
    routeLegId: "00000000-0000-4000-8000-000000000601",
    sourceRef: "deal:deal-1:leg:1:payin:1",
    state: "planned" as const,
    updatedAt: new Date("2026-04-03T10:00:00.000Z"),
  };
}

function createExecutionFeeRow() {
  return {
    amountMinor: 50n,
    calculationSnapshotId: null,
    chargedAt: new Date("2026-04-03T10:10:00.000Z"),
    componentCode: null,
    confirmedAt: new Date("2026-04-03T10:15:00.000Z"),
    createdAt: new Date("2026-04-03T10:10:00.000Z"),
    currencyId: "00000000-0000-4000-8000-000000000101",
    dealId: "00000000-0000-4000-8000-000000000301",
    externalRecordId: "statement:1",
    feeFamily: "provider_fee",
    fillId: null,
    id: "00000000-0000-4000-8000-000000000701",
    instructionId: "00000000-0000-4000-8000-000000000801",
    metadata: { provider: "bank-a" },
    notes: "manual confirmation",
    operationId: "00000000-0000-4000-8000-000000000401",
    providerCounterpartyId: null,
    providerRef: "provider-1",
    routeComponentId: null,
    routeLegId: "00000000-0000-4000-8000-000000000601",
    routeVersionId: null,
    sourceKind: "manual" as const,
    sourceRef: "fee:operation-1:manual-1",
    updatedAt: new Date("2026-04-03T10:10:00.000Z"),
  };
}

function createActualRepositories() {
  return {
    cashMovementsRepository: {
      findCashMovementBySourceRef: vi.fn(),
      insertCashMovement: vi.fn(),
      listCashMovements: vi.fn(),
    },
    executionFeesRepository: {
      findFeeBySourceRef: vi.fn(),
      insertFee: vi.fn(),
      listFees: vi.fn(),
    },
    executionFillsRepository: {
      findFillBySourceRef: vi.fn(),
      insertFill: vi.fn(),
      listFills: vi.fn(),
    },
  };
}

describe("treasury operations service", () => {
  it("returns the existing operation when sourceRef already exists", async () => {
    const existing = createOperationRow();
    const repositories = createActualRepositories();
    const operations = createTreasuryOperationsService({
      ...repositories,
      operationsRepository: {
        findOperationById: vi.fn(),
        findOperationBySourceRef: vi.fn(async () => existing),
        insertOperation: vi.fn(async () => null),
        listOperations: vi.fn(),
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

  it("lists operations with kind, internal-entity filters, sort, and pagination", async () => {
    const existing = createOperationRow();
    const repositories = createActualRepositories();
    const listOperations = vi.fn(async () => ({
      rows: [existing],
      total: 1,
    }));
    const operations = createTreasuryOperationsService({
      ...repositories,
      operationsRepository: {
        findOperationById: vi.fn(),
        findOperationBySourceRef: vi.fn(),
        insertOperation: vi.fn(),
        listOperations,
      },
      runtime: {
        generateUuid: vi.fn(),
        log: vi.fn(),
        logger: vi.fn(),
        now: vi.fn(),
      } as any,
    });

    const result = await operations.queries.list({
      dealId: existing.dealId ?? undefined,
      internalEntityOrganizationId:
        existing.internalEntityOrganizationId ?? undefined,
      kind: ["payin"],
      limit: 10,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(listOperations).toHaveBeenCalledWith({
      dealId: existing.dealId ?? undefined,
      internalEntityOrganizationId:
        existing.internalEntityOrganizationId ?? undefined,
      kind: ["payin"],
      limit: 10,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(result).toEqual({
      data: [
        {
          amountMinor: "10000",
          counterAmountMinor: null,
          counterCurrencyId: null,
          createdAt: existing.createdAt,
          currencyId: "00000000-0000-4000-8000-000000000101",
          customerId: "00000000-0000-4000-8000-000000000201",
          dealId: "00000000-0000-4000-8000-000000000301",
          id: "00000000-0000-4000-8000-000000000401",
          internalEntityOrganizationId:
            "00000000-0000-4000-8000-000000000501",
          kind: "payin",
          quoteId: null,
          routeLegId: "00000000-0000-4000-8000-000000000601",
          sourceRef: "deal:deal-1:leg:1:payin:1",
          state: "planned",
          updatedAt: existing.updatedAt,
        },
      ],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });

  it("records execution fees and derives deal and route leg from the planned operation", async () => {
    const operation = createOperationRow();
    const fee = createExecutionFeeRow();
    const repositories = createActualRepositories();
    repositories.executionFeesRepository.insertFee.mockResolvedValue(fee);
    const operations = createTreasuryOperationsService({
      ...repositories,
      operationsRepository: {
        findOperationById: vi.fn(async () => operation),
        findOperationBySourceRef: vi.fn(),
        insertOperation: vi.fn(),
        listOperations: vi.fn(),
      },
      runtime: {
        generateUuid: vi.fn(() => fee.id),
        log: vi.fn(),
        logger: vi.fn(),
        now: vi.fn(() => fee.chargedAt),
      } as any,
    });

    const result = await operations.commands.recordExecutionFee({
      amountMinor: 50n,
      feeFamily: "provider_fee",
      operationId: operation.id,
      sourceKind: "manual",
      sourceRef: fee.sourceRef,
    });

    expect(repositories.executionFeesRepository.insertFee).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 50n,
        currencyId: operation.currencyId,
        dealId: operation.dealId,
        feeFamily: "provider_fee",
        operationId: operation.id,
        routeLegId: operation.routeLegId,
        sourceKind: "manual",
        sourceRef: fee.sourceRef,
      }),
    );
    expect(result).toEqual({
      amountMinor: "50",
      calculationSnapshotId: null,
      chargedAt: fee.chargedAt,
      componentCode: null,
      confirmedAt: fee.confirmedAt,
      createdAt: fee.createdAt,
      currencyId: fee.currencyId,
      dealId: fee.dealId,
      externalRecordId: fee.externalRecordId,
      feeFamily: fee.feeFamily,
      fillId: null,
      id: fee.id,
      instructionId: fee.instructionId,
      metadata: fee.metadata,
      notes: fee.notes,
      operationId: fee.operationId,
      providerCounterpartyId: null,
      providerRef: fee.providerRef,
      routeComponentId: null,
      routeLegId: fee.routeLegId,
      routeVersionId: null,
      sourceKind: fee.sourceKind,
      sourceRef: fee.sourceRef,
      updatedAt: fee.updatedAt,
    });
  });

  it("lists execution fees with deal, route-leg, and source-kind filters", async () => {
    const fee = createExecutionFeeRow();
    const repositories = createActualRepositories();
    repositories.executionFeesRepository.listFees.mockResolvedValue({
      rows: [fee],
      total: 1,
    });
    const operations = createTreasuryOperationsService({
      ...repositories,
      operationsRepository: {
        findOperationById: vi.fn(),
        findOperationBySourceRef: vi.fn(),
        insertOperation: vi.fn(),
        listOperations: vi.fn(),
      },
      runtime: {
        generateUuid: vi.fn(),
        log: vi.fn(),
        logger: vi.fn(),
        now: vi.fn(),
      } as any,
    });

    const result = await operations.queries.listExecutionFees({
      dealId: fee.dealId ?? undefined,
      limit: 10,
      offset: 0,
      operationId: fee.operationId,
      routeLegId: fee.routeLegId ?? undefined,
      sortBy: "chargedAt",
      sortOrder: "desc",
      sourceKind: ["manual"],
    });

    expect(repositories.executionFeesRepository.listFees).toHaveBeenCalledWith({
      dealId: fee.dealId ?? undefined,
      limit: 10,
      offset: 0,
      operationId: fee.operationId,
      routeLegId: fee.routeLegId ?? undefined,
      sortBy: "chargedAt",
      sortOrder: "desc",
      sourceKind: ["manual"],
    });
    expect(result).toEqual({
      data: [
        {
          amountMinor: "50",
          calculationSnapshotId: null,
          chargedAt: fee.chargedAt,
          componentCode: null,
          confirmedAt: fee.confirmedAt,
          createdAt: fee.createdAt,
          currencyId: fee.currencyId,
          dealId: fee.dealId,
          externalRecordId: fee.externalRecordId,
          feeFamily: fee.feeFamily,
          fillId: null,
          id: fee.id,
          instructionId: fee.instructionId,
          metadata: fee.metadata,
          notes: fee.notes,
          operationId: fee.operationId,
          providerCounterpartyId: null,
          providerRef: fee.providerRef,
          routeComponentId: null,
          routeLegId: fee.routeLegId,
          routeVersionId: null,
          sourceKind: fee.sourceKind,
          sourceRef: fee.sourceRef,
          updatedAt: fee.updatedAt,
        },
      ],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });

  it("validates execution fee contracts for source kind and list filters", () => {
    expect(TreasuryOperationFactSourceKindSchema.safeParse("provider").success).toBe(
      true,
    );
    expect(
      RecordTreasuryExecutionFeeInputSchema.safeParse({
        feeFamily: "provider_fee",
        operationId: "00000000-0000-4000-8000-000000000401",
        sourceKind: "manual",
        sourceRef: "fee:1",
      }).success,
    ).toBe(true);
    expect(
      ListTreasuryExecutionFeesQuerySchema.safeParse({
        limit: 10,
        offset: 0,
        routeLegId: "00000000-0000-4000-8000-000000000601",
        sourceKind: ["manual"],
      }).success,
    ).toBe(true);
  });
});
