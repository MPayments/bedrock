import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usePathname = vi.fn();
const renderWorkspaceTabs = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname,
}));

vi.mock("@/components/entities/workspace-layout", () => ({
  EntityWorkspaceLayout: ({
    children,
    controls,
  }: {
    children?: ReactNode;
    controls?: ReactNode;
  }) => createElement(Fragment, null, controls, children),
  EntityWorkspaceTabs: (props: unknown) => {
    renderWorkspaceTabs(props);
    return null;
  },
}));

describe("organization workspace layout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("maps detail routes to the matching organization tabs", async () => {
    const { OrganizationWorkspaceLayout } = await import(
      "@/features/entities/organizations/components/organization-workspace-layout"
    );

    usePathname.mockReturnValue("/entities/organizations/org-1");
    renderToStaticMarkup(
      createElement(OrganizationWorkspaceLayout, {
        title: "Bedrock",
        subtitle: "Карточка организации",
        children: null,
      }, null),
    );

    expect(renderWorkspaceTabs.mock.calls[0]?.[0]).toEqual({
      value: "general",
      tabs: [
        {
          id: "general",
          label: "Информация",
          icon: expect.anything(),
          href: "/entities/organizations/org-1",
          disabled: false,
        },
        {
          id: "accounts",
          label: "Реквизиты",
          icon: expect.anything(),
          href: "/entities/organizations/org-1/requisites",
          disabled: false,
        },
        {
          id: "documents",
          label: "Документы",
          icon: expect.anything(),
          href: "/entities/organizations/org-1/documents",
          disabled: false,
        },
      ],
    });

    usePathname.mockReturnValue("/entities/organizations/org-1/requisites");
    renderToStaticMarkup(
      createElement(OrganizationWorkspaceLayout, {
        title: "Bedrock",
        subtitle: "Карточка организации",
        children: null,
      }, null),
    );

    expect(renderWorkspaceTabs.mock.calls[1]?.[0]).toEqual({
      value: "accounts",
      tabs: [
        {
          id: "general",
          label: "Информация",
          icon: expect.anything(),
          href: "/entities/organizations/org-1",
          disabled: false,
        },
        {
          id: "accounts",
          label: "Реквизиты",
          icon: expect.anything(),
          href: "/entities/organizations/org-1/requisites",
          disabled: false,
        },
        {
          id: "documents",
          label: "Документы",
          icon: expect.anything(),
          href: "/entities/organizations/org-1/documents",
          disabled: false,
        },
      ],
    });

    usePathname.mockReturnValue("/treasury/organizations/org-1/documents");
    renderToStaticMarkup(
      createElement(OrganizationWorkspaceLayout, {
        title: "Bedrock",
        subtitle: "Карточка организации",
        children: null,
      }, null),
    );

    expect(renderWorkspaceTabs.mock.calls[2]?.[0]).toEqual({
      value: "documents",
      tabs: [
        {
          id: "general",
          label: "Информация",
          icon: expect.anything(),
          href: "/treasury/organizations/org-1",
          disabled: false,
        },
        {
          id: "accounts",
          label: "Реквизиты",
          icon: expect.anything(),
          href: "/treasury/organizations/org-1/requisites",
          disabled: false,
        },
        {
          id: "documents",
          label: "Документы",
          icon: expect.anything(),
          href: "/treasury/organizations/org-1/documents",
          disabled: false,
        },
      ],
    });
  });
});
