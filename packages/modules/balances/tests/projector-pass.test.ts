import { describe, expect, it, vi } from "vitest";

import { noopLogger } from "@bedrock/platform/observability/logger";

import { createRunProjectorPassHandler } from "../src/application/projection/commands";
import type { ProjectionOperationRow, ProjectionPostingRow } from "../src/domain/projection";

function createOperation(
  input: Partial<ProjectionOperationRow> & Pick<ProjectionOperationRow, "id">,
): ProjectionOperationRow {
  return {
    id: input.id,
    sourceType: input.sourceType ?? "document",
    sourceId: input.sourceId ?? `source:${input.id}`,
    operationCode: input.operationCode ?? "TRANSFER.POSTED",
    postedAt: input.postedAt ?? new Date("2026-03-01T00:00:00.000Z"),
  };
}

function createPostingRow(
  input: Partial<ProjectionPostingRow> &
    Pick<ProjectionPostingRow, "operationId" | "bookId">,
): ProjectionPostingRow {
  return {
    operationId: input.operationId,
    sourceType: input.sourceType ?? "document",
    sourceId: input.sourceId ?? `source:${input.operationId}`,
    operationCode: input.operationCode ?? "TRANSFER.POSTED",
    lineNo: input.lineNo ?? 1,
    bookId: input.bookId,
    currency: input.currency ?? "USD",
    amountMinor: input.amountMinor ?? 100n,
    postingCode: input.postingCode ?? "TR.INTRA.IMMEDIATE",
    debitDimensions: input.debitDimensions ?? {
      organizationRequisiteId: `${input.operationId}:debit`,
    },
    creditDimensions: input.creditDimensions ?? {
      organizationRequisiteId: `${input.operationId}:credit`,
    },
  };
}

describe("runProjectorPass", () => {
  it("loads posting rows once for the whole operation batch", async () => {
    const operations = [createOperation({ id: "op-1" }), createOperation({ id: "op-2" })];
    const postingRowsByOperationId = new Map<string, ProjectionPostingRow[]>([
      ["op-1", [createPostingRow({ operationId: "op-1", bookId: "book-1" })]],
      ["op-2", [createPostingRow({ operationId: "op-2", bookId: "book-2" })]],
    ]);
    const projection = {
      ensureCursor: vi.fn().mockResolvedValue({
        workerKey: "ledger_posted",
        lastPostedAt: null,
        lastOperationId: null,
      }),
      listOperationsAfterCursor: vi.fn().mockResolvedValue(operations),
      listProjectionPostingRowsForOperations: vi
        .fn()
        .mockResolvedValue(postingRowsByOperationId),
      applyProjectedDelta: vi.fn().mockResolvedValue(true),
      advanceCursor: vi.fn().mockResolvedValue(undefined),
    };
    const withTransaction = vi.fn(
      async (
        run: (context: { projectionRepository: typeof projection }) => Promise<unknown>,
      ) =>
        run({ projectionRepository: projection }),
    );
    const runProjectorPass = createRunProjectorPassHandler({
      context: {
        log: noopLogger,
        transactions: { withTransaction },
      },
    });

    await expect(runProjectorPass()).resolves.toBe(2);

    expect(projection.listProjectionPostingRowsForOperations).toHaveBeenCalledTimes(1);
    expect(projection.listProjectionPostingRowsForOperations).toHaveBeenCalledWith(
      operations,
    );
    expect(projection.advanceCursor).toHaveBeenCalledTimes(2);
    expect(projection.advanceCursor).toHaveBeenNthCalledWith(1, {
      postedAt: operations[0]!.postedAt,
      operationId: "op-1",
    });
    expect(projection.advanceCursor).toHaveBeenNthCalledWith(2, {
      postedAt: operations[1]!.postedAt,
      operationId: "op-2",
    });
  });
});
