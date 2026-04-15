import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getFinanceDealReconciliationWorkspaceById = vi.fn();
const renderReconciliationWorkspace = vi.fn<(props: unknown) => null>(() => null);

vi.mock("@/features/treasury/deals/lib/reconciliation-workspace", () => ({
  getFinanceDealReconciliationWorkspaceById,
}));

vi.mock("@/features/treasury/deals/components/reconciliation-workspace", () => ({
  ReconciliationWorkspace: (props: unknown) => {
    renderReconciliationWorkspace(props);
    return createElement("section");
  },
}));

describe("treasury deal reconciliation page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getFinanceDealReconciliationWorkspaceById.mockResolvedValue({
      cashMovements: [],
      currencies: [],
      deal: {
        summary: {
          applicantDisplayName: "ООО Ромашка",
          calculationId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          createdAt: "2026-04-02T08:07:00.000Z",
          id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          internalEntityDisplayName: "Мультиханса",
          status: "reconciling",
          type: "payment",
          updatedAt: "2026-04-02T08:07:00.000Z",
        },
      },
      fees: [],
      fills: [],
    });
  });

  it("loads reconciliation workspace data and passes it to the page component", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { default: TreasuryDealReconciliationPage } = await import(
      "@/app/(shell)/treasury/deals/[id]/reconciliation/page"
    );

    renderToStaticMarkup(
      await TreasuryDealReconciliationPage({
        params: Promise.resolve({
          id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        }),
      }),
    );

    expect(getFinanceDealReconciliationWorkspaceById).toHaveBeenCalledWith(
      "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );
    expect(renderReconciliationWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deal: expect.objectContaining({
            summary: expect.objectContaining({
              applicantDisplayName: "ООО Ромашка",
              status: "reconciling",
            }),
          }),
        }),
      }),
    );
  });
});
