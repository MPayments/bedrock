import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getFinanceDealExecutionWorkspaceById = vi.fn();
const renderExecutionWorkspace = vi.fn<(props: unknown) => null>(() => null);

vi.mock("@/features/treasury/deals/lib/execution-workspace", () => ({
  getFinanceDealExecutionWorkspaceById,
}));

vi.mock("@/features/treasury/deals/components/execution-workspace", () => ({
  ExecutionWorkspace: (props: unknown) => {
    renderExecutionWorkspace(props);
    return createElement("section");
  },
}));

describe("treasury deal execution page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getFinanceDealExecutionWorkspaceById.mockResolvedValue({
      cashMovements: [],
      currencies: [],
      deal: {
        summary: {
          applicantDisplayName: "ООО Ромашка",
          calculationId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          createdAt: "2026-04-02T08:07:00.000Z",
          id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          internalEntityDisplayName: "Мультиханса",
          status: "executing",
          type: "payment",
          updatedAt: "2026-04-02T08:07:00.000Z",
        },
      },
      fees: [],
      fills: [],
    });
  });

  it("loads execution workspace data and passes it to the page component", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { default: TreasuryDealExecutionPage } = await import(
      "@/app/(shell)/treasury/deals/[id]/execution/page"
    );

    renderToStaticMarkup(
      await TreasuryDealExecutionPage({
        params: Promise.resolve({
          id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        }),
      }),
    );

    expect(getFinanceDealExecutionWorkspaceById).toHaveBeenCalledWith(
      "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );
    expect(renderExecutionWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deal: expect.objectContaining({
            summary: expect.objectContaining({
              applicantDisplayName: "ООО Ромашка",
              status: "executing",
            }),
          }),
        }),
      }),
    );
  });
});
