import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const renderEntityTableShell = vi.fn<(props: unknown) => null>(() => null);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

vi.mock("@bedrock/sdk-tables-ui/components/entity-table-shell", () => ({
  EntityTableShell: (props: unknown) => {
    renderEntityTableShell(props);
    return null;
  },
}));

describe("treasury operations table", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;
  });

  it("renders the operations table and opens the operation panel on row double click", async () => {
    const result = {
      data: [],
      limit: 10,
      offset: 0,
      total: 0,
      viewCounts: {
        all: 7,
        exceptions: 2,
        fx: 1,
        incoming: 1,
        intercompany: 1,
        intracompany: 1,
        outgoing: 1,
      },
    };
    const { TreasuryOperationsTable } = await import(
      "@/features/treasury/operations/components/table"
    );

    const markup = renderToStaticMarkup(
      createElement(TreasuryOperationsTable, {
        promise: {
          status: "fulfilled",
          value: result,
          then() {
            return this;
          },
        } as unknown as Promise<typeof result>,
      }),
    );
    expect(markup).toBe("");

    expect(renderEntityTableShell).toHaveBeenCalledTimes(1);

    const props = renderEntityTableShell.mock.calls[0]?.[0] as unknown as {
      columns: Array<{ accessorKey?: string; id?: string }>;
      getRowId: (row: { id: string }) => string;
      initialState: {
        sorting: Array<{ id: string; desc: boolean }>;
      };
      onRowDoubleClick: (row: { original: { id: string } }) => void;
    };

    expect(props.columns.map((column) => column.accessorKey ?? column.id)).toEqual([
      "kind",
      "amount",
      "internalEntity",
      "accounts",
      "providerRoute",
      "instructionStatus",
      "dealRef",
      "nextAction",
      "createdAt",
    ]);
    expect(props.initialState).toEqual({
      sorting: [{ id: "createdAt", desc: true }],
    });
    expect(props.getRowId({ id: "operation-1" })).toBe("operation-1");

    props.onRowDoubleClick({
      original: {
        id: "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
    });

    expect(push).toHaveBeenCalledWith(
      "/treasury/operations/114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );
  }, 15_000);
});
