import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listFinanceRouteTemplates = vi.fn();
const renderRouteTemplatesList = vi.fn<(props: unknown) => null>(() => null);

vi.mock("@/features/treasury/route-templates/lib/queries", () => ({
  listFinanceRouteTemplates,
}));

vi.mock("@/features/treasury/route-templates/components/list", () => ({
  RouteTemplatesList: (props: unknown) => {
    renderRouteTemplatesList(props);
    return createElement("section");
  },
}));

describe("route templates page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    listFinanceRouteTemplates.mockResolvedValue([
      {
        code: "rub-usd-payout",
        createdAt: "2026-04-01T08:00:00.000Z",
        dealType: "payment",
        description: "RUB collection -> USD payout",
        id: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        name: "RUB -> USD payout",
        status: "published",
        updatedAt: "2026-04-02T08:00:00.000Z",
      },
    ]);
  });

  it("loads route templates and passes them to the list component", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { default: RouteTemplatesPage } = await import(
      "@/app/(shell)/route-templates/page"
    );

    renderToStaticMarkup(await RouteTemplatesPage());

    expect(listFinanceRouteTemplates).toHaveBeenCalledWith();
    expect(renderRouteTemplatesList).toHaveBeenCalledWith(
      expect.objectContaining({
        templates: [
          expect.objectContaining({
            name: "RUB -> USD payout",
          }),
        ],
      }),
    );
  });
});
