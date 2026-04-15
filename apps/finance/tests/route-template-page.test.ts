import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getFinanceRouteTemplateWorkspaceById = vi.fn();
const renderRouteTemplateWorkspace = vi.fn<(props: unknown) => null>(() => null);

vi.mock("@/features/treasury/route-templates/lib/queries", () => ({
  getFinanceRouteTemplateWorkspaceById,
}));

vi.mock("@/features/treasury/route-templates/components/workspace", () => ({
  RouteTemplateWorkspace: (props: unknown) => {
    renderRouteTemplateWorkspace(props);
    return createElement("section");
  },
}));

describe("route template page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getFinanceRouteTemplateWorkspaceById.mockResolvedValue({
      currencies: [],
      lookupContext: {
        lookupDefaults: {
          defaultLimit: 20,
          maxLimit: 50,
          prefixMatching: true,
        },
        participantKinds: [],
        roleHints: [],
        strictSemantics: {
          accessControlOwnedByIam: true,
          customerLegalEntitiesViaCounterparties: true,
          organizationsInternalOnly: true,
          subAgentsRequireCanonicalProfile: true,
        },
      },
      template: {
        code: "rub-usd-payout",
        costComponents: [],
        createdAt: "2026-04-01T08:00:00.000Z",
        dealType: "payment",
        description: "RUB collection -> USD payout",
        id: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        legs: [],
        name: "RUB -> USD payout",
        participants: [],
        status: "draft",
        updatedAt: "2026-04-02T08:00:00.000Z",
      },
    });
  });

  it("loads route template workspace data and passes it to the workspace component", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { default: RouteTemplatePage } = await import(
      "@/app/(shell)/route-templates/[templateId]/page"
    );

    renderToStaticMarkup(
      await RouteTemplatePage({
        params: Promise.resolve({
          templateId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        }),
      }),
    );

    expect(getFinanceRouteTemplateWorkspaceById).toHaveBeenCalledWith(
      "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );
    expect(renderRouteTemplateWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          template: expect.objectContaining({
            name: "RUB -> USD payout",
          }),
        }),
      }),
    );
  });
});
