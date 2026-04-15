import { describe, expect, it, vi } from "vitest";

import {
  CreatePlannedTreasuryOperationInputSchema,
  ListTreasuryOperationFactsQuerySchema,
  RecordTreasuryOperationFactInputSchema,
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

function createOperationFactRow() {
  return {
    amountMinor: 9950n,
    confirmedAt: new Date("2026-04-03T10:15:00.000Z"),
    counterAmountMinor: null,
    counterCurrencyId: null,
    createdAt: new Date("2026-04-03T10:10:00.000Z"),
    currencyId: "00000000-0000-4000-8000-000000000101",
    dealId: "00000000-0000-4000-8000-000000000301",
    externalRecordId: "statement:1",
    feeAmountMinor: 50n,
    feeCurrencyId: "00000000-0000-4000-8000-000000000101",
    id: "00000000-0000-4000-8000-000000000701",
    instructionId: "00000000-0000-4000-8000-000000000801",
    metadata: { provider: "bank-a" },
    notes: "manual confirmation",
    operationId: "00000000-0000-4000-8000-000000000401",
    providerRef: "provider-1",
    recordedAt: new Date("2026-04-03T10:10:00.000Z"),
    routeLegId: "00000000-0000-4000-8000-000000000601",
    sourceKind: "manual" as const,
    sourceRef: "fact:operation-1:manual-1",
    updatedAt: new Date("2026-04-03T10:10:00.000Z"),
  };
}

describe("treasury operations service", () => {
  it("returns the existing operation when sourceRef already exists", async () => {
    const existing = createOperationRow();
    const operations = createTreasuryOperationsService({
      factsRepository: {
        findFactBySourceRef: vi.fn(),
        insertFact: vi.fn(),
        listFacts: vi.fn(),
      },
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

  it("lists operations with kind, internal-entity filters, sort, and pagination", async () => {
    const existing = createOperationRow();
    const listOperations = vi.fn(async () => ({
      rows: [existing],
      total: 1,
    }));
    const operations = createTreasuryOperationsService({
      factsRepository: {
        findFactBySourceRef: vi.fn(),
        insertFact: vi.fn(),
        listFacts: vi.fn(),
      },
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

  it("records actual facts and derives deal and route leg from the planned operation", async () => {
    const operation = createOperationRow();
    const fact = createOperationFactRow();
    const insertFact = vi.fn(async () => fact);
    const operations = createTreasuryOperationsService({
      factsRepository: {
        findFactBySourceRef: vi.fn(),
        insertFact,
        listFacts: vi.fn(),
      },
      operationsRepository: {
        findOperationById: vi.fn(async () => operation),
        findOperationBySourceRef: vi.fn(),
        insertOperation: vi.fn(),
        listOperations: vi.fn(),
      },
      runtime: {
        generateUuid: vi.fn(() => fact.id),
        log: vi.fn(),
        logger: vi.fn(),
        now: vi.fn(() => fact.recordedAt),
      } as any,
    });

    const result = await operations.commands.recordActualFact({
      amountMinor: 9950n,
      feeAmountMinor: 50n,
      feeCurrencyId: operation.currencyId,
      operationId: operation.id,
      sourceKind: "manual",
      sourceRef: fact.sourceRef,
    });

    expect(insertFact).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 9950n,
        currencyId: operation.currencyId,
        dealId: operation.dealId,
        feeAmountMinor: 50n,
        feeCurrencyId: operation.currencyId,
        operationId: operation.id,
        routeLegId: operation.routeLegId,
        sourceKind: "manual",
        sourceRef: fact.sourceRef,
      }),
    );
    expect(result).toEqual({
      amountMinor: "9950",
      confirmedAt: fact.confirmedAt,
      counterAmountMinor: null,
      counterCurrencyId: null,
      createdAt: fact.createdAt,
      currencyId: fact.currencyId,
      dealId: fact.dealId,
      externalRecordId: fact.externalRecordId,
      feeAmountMinor: "50",
      feeCurrencyId: fact.feeCurrencyId,
      id: fact.id,
      instructionId: fact.instructionId,
      metadata: fact.metadata,
      notes: fact.notes,
      operationId: fact.operationId,
      providerRef: fact.providerRef,
      recordedAt: fact.recordedAt,
      routeLegId: fact.routeLegId,
      sourceKind: fact.sourceKind,
      sourceRef: fact.sourceRef,
      updatedAt: fact.updatedAt,
    });
  });

  it("lists operation facts with deal, route-leg, and source-kind filters", async () => {
    const fact = createOperationFactRow();
    const listFacts = vi.fn(async () => ({
      rows: [fact],
      total: 1,
    }));
    const operations = createTreasuryOperationsService({
      factsRepository: {
        findFactBySourceRef: vi.fn(),
        insertFact: vi.fn(),
        listFacts,
      },
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

    const result = await operations.queries.listFacts({
      dealId: fact.dealId ?? undefined,
      limit: 10,
      offset: 0,
      operationId: fact.operationId,
      routeLegId: fact.routeLegId ?? undefined,
      sortBy: "recordedAt",
      sortOrder: "desc",
      sourceKind: ["manual"],
    });

    expect(listFacts).toHaveBeenCalledWith({
      dealId: fact.dealId ?? undefined,
      limit: 10,
      offset: 0,
      operationId: fact.operationId,
      routeLegId: fact.routeLegId ?? undefined,
      sortBy: "recordedAt",
      sortOrder: "desc",
      sourceKind: ["manual"],
    });
    expect(result).toEqual({
      data: [
        {
          amountMinor: "9950",
          confirmedAt: fact.confirmedAt,
          counterAmountMinor: null,
          counterCurrencyId: null,
          createdAt: fact.createdAt,
          currencyId: fact.currencyId,
          dealId: fact.dealId,
          externalRecordId: fact.externalRecordId,
          feeAmountMinor: "50",
          feeCurrencyId: fact.feeCurrencyId,
          id: fact.id,
          instructionId: fact.instructionId,
          metadata: fact.metadata,
          notes: fact.notes,
          operationId: fact.operationId,
          providerRef: fact.providerRef,
          recordedAt: fact.recordedAt,
          routeLegId: fact.routeLegId,
          sourceKind: fact.sourceKind,
          sourceRef: fact.sourceRef,
          updatedAt: fact.updatedAt,
        },
      ],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });

  it("validates fact contracts for source kind and list filters", () => {
    expect(TreasuryOperationFactSourceKindSchema.safeParse("provider").success).toBe(
      true,
    );
    expect(
      RecordTreasuryOperationFactInputSchema.safeParse({
        operationId: "00000000-0000-4000-8000-000000000401",
        sourceKind: "manual",
        sourceRef: "fact:1",
      }).success,
    ).toBe(true);
    expect(
      ListTreasuryOperationFactsQuerySchema.safeParse({
        limit: 10,
        offset: 0,
        routeLegId: "00000000-0000-4000-8000-000000000601",
        sourceKind: ["manual"],
      }).success,
    ).toBe(true);
  });
});
