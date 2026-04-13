import { describe, expect, it, vi } from "vitest";

import { createListOperationLinksHandler } from "../src/application/links/queries";

function createMatchRow(input: {
  createdAt?: Date;
  matchedOperationId: string | null;
  matchedOperationKind?: "ledger" | "treasury";
}) {
  return {
    createdAt: input.createdAt ?? new Date("2026-04-03T09:00:00.000Z"),
    explanation: {
      basis: "matched_amount",
      confidence: 0.91,
      reason: "Matched by operation id",
    },
    externalRecordId: "external-record-1",
    id: "match-1",
    matchedDocumentId: null,
    matchedOperationId:
      input.matchedOperationKind === "treasury"
        ? null
        : input.matchedOperationId,
    matchedOperationRef: input.matchedOperationId
      ? {
          id: input.matchedOperationId,
          kind: input.matchedOperationKind ?? "ledger",
        }
      : null,
    matchedTreasuryOperationId:
      input.matchedOperationKind === "treasury"
        ? input.matchedOperationId
        : null,
    runId: "run-1",
    status: "matched",
  } as const;
}

function createExceptionRow(input: {
  candidateOperationIds?: string[];
  createdAt?: Date;
  externalRecordId?: string;
  id: string;
  operationId?: string | null;
  resolvedAt?: Date | null;
  state?: "ignored" | "open" | "resolved";
}) {
  return {
    exception: {
      adjustmentDocumentId: null,
      createdAt: input.createdAt ?? new Date("2026-04-03T10:00:00.000Z"),
      externalRecordId: input.externalRecordId ?? "external-record-1",
      id: input.id,
      reasonCode: "no_match",
      reasonMeta: null,
      resolvedAt: input.resolvedAt ?? null,
      runId: "run-1",
      state: input.state ?? "open",
    },
    externalRecord: {
      id: input.externalRecordId ?? "external-record-1",
      normalizedPayload: {
        candidateOperationIds: input.candidateOperationIds ?? [],
        operationId: input.operationId ?? null,
      },
      rawPayload: {},
      receivedAt: new Date("2026-04-03T09:30:00.000Z"),
      source: "bank_statement",
      sourceRecordId: `record-${input.id}`,
    },
    run: {
      causationId: null,
      correlationId: null,
      createdAt: new Date("2026-04-03T09:45:00.000Z"),
      id: "run-1",
      inputQuery: {},
      requestId: null,
      resultSummary: {
        exceptionCount: 1,
        matchedCount: 0,
        unmatchedCount: 1,
      },
      rulesetChecksum: "checksum-1",
      source: "bank_statement",
      traceId: null,
    },
  } as const;
}

function createHandler(input?: {
  exceptionRows?: ReturnType<typeof createExceptionRow>[];
  matchedRows?: ReturnType<typeof createMatchRow>[];
}) {
  return createListOperationLinksHandler({
    documents: {
      existsById: vi.fn(async () => false),
    },
    exceptions: {
      list: vi.fn(async () => []),
      listLinkedToOperationIds: vi.fn(async () => input?.exceptionRows ?? []),
    },
    ledgerLookup: {
      operationExists: vi.fn(async () => true),
      treasuryOperationExists: vi.fn(async () => true),
    },
    log: {
      child: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      warn: vi.fn(),
    } as never,
    matches: {
      findById: vi.fn(async () => null),
      listByMatchedOperationIds: vi.fn(async () => input?.matchedRows ?? []),
    },
    pendingSources: {
      listPendingSources: vi.fn(async () => []),
    },
    transactions: {
      withTransaction: vi.fn(),
    },
  });
}

describe("createListOperationLinksHandler", () => {
  it("resolves reconciliation matches by matched operation id", async () => {
    const listOperationLinks = createHandler({
      matchedRows: [
        createMatchRow({ matchedOperationId: "operation-1" }),
        createMatchRow({
          createdAt: new Date("2026-04-03T11:00:00.000Z"),
          matchedOperationId: "operation-1",
        }),
      ],
    });

    const result = await listOperationLinks({
      operationIds: ["operation-1", "operation-2"],
    });

    expect(result).toEqual([
      expect.objectContaining({
        exceptions: [],
        lastActivityAt: new Date("2026-04-03T11:00:00.000Z"),
        matchCount: 2,
        operationId: "operation-1",
      }),
      expect.objectContaining({
        exceptions: [],
        lastActivityAt: null,
        matchCount: 0,
        operationId: "operation-2",
      }),
    ]);
  });

  it("counts treasury reconciliation matches by matched operation ref", async () => {
    const listOperationLinks = createHandler({
      matchedRows: [
        createMatchRow({
          matchedOperationId: "treasury-operation-1",
          matchedOperationKind: "treasury",
        }),
      ],
    });

    const [result] = await listOperationLinks({
      operationIds: ["treasury-operation-1"],
    });

    expect(result).toMatchObject({
      exceptions: [],
      matchCount: 1,
      operationId: "treasury-operation-1",
    });
  });

  it("links exceptions by normalizedPayload.operationId before candidate fallbacks", async () => {
    const listOperationLinks = createHandler({
      exceptionRows: [
        createExceptionRow({
          candidateOperationIds: ["operation-2"],
          id: "exception-1",
          operationId: "operation-1",
        }),
      ],
    });

    const result = await listOperationLinks({
      operationIds: ["operation-1", "operation-2"],
    });

    expect(result[0]).toMatchObject({
      exceptions: [
        expect.objectContaining({
          id: "exception-1",
          operationId: "operation-1",
          source: "bank_statement",
        }),
      ],
      matchCount: 0,
      operationId: "operation-1",
    });
    expect(result[1]).toMatchObject({
      exceptions: [],
      operationId: "operation-2",
    });
  });

  it("links exceptions by candidateOperationIds when no primary operation id exists", async () => {
    const listOperationLinks = createHandler({
      exceptionRows: [
        createExceptionRow({
          candidateOperationIds: ["operation-2", "operation-3"],
          id: "exception-1",
        }),
      ],
    });

    const result = await listOperationLinks({
      operationIds: ["operation-1", "operation-2", "operation-3"],
    });

    expect(result[1]?.exceptions).toEqual([
      expect.objectContaining({
        id: "exception-1",
        operationId: "operation-2",
      }),
    ]);
    expect(result[2]?.exceptions).toEqual([
      expect.objectContaining({
        id: "exception-1",
        operationId: "operation-3",
      }),
    ]);
  });

  it("deduplicates repeated exception refs per operation and sorts newest first", async () => {
    const listOperationLinks = createHandler({
      exceptionRows: [
        createExceptionRow({
          candidateOperationIds: ["operation-1"],
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          id: "exception-1",
        }),
        createExceptionRow({
          candidateOperationIds: ["operation-1"],
          createdAt: new Date("2026-04-03T10:30:00.000Z"),
          id: "exception-2",
        }),
        createExceptionRow({
          candidateOperationIds: ["operation-1"],
          createdAt: new Date("2026-04-03T10:15:00.000Z"),
          id: "exception-2",
        }),
      ],
    });

    const [result] = await listOperationLinks({
      operationIds: ["operation-1"],
    });

    expect(result?.exceptions.map((exception) => exception.id)).toEqual([
      "exception-2",
      "exception-1",
    ]);
    expect(result?.lastActivityAt).toEqual(new Date("2026-04-03T10:30:00.000Z"));
  });
});
