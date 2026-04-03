import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useOrganizationDraftName = vi.fn();
const renderOrganizationWorkspaceLayout = vi.fn();

vi.mock("@/features/entities/organizations/lib/create-draft-name-context", () => ({
  useOrganizationDraftName,
}));

vi.mock("@/features/entities/organizations/components/organization-workspace-layout", () => ({
  OrganizationWorkspaceLayout: (props: unknown) => {
    renderOrganizationWorkspaceLayout(props);
    return null;
  },
}));

describe("organization create workspace layout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    useOrganizationDraftName.mockReturnValue({
      state: { createLabel: "Новая организация" },
      actions: { resetCreateName: vi.fn() },
    });
  });

  it("disables edit-only tabs on create routes", async () => {
    const { OrganizationCreateWorkspaceLayout } = await import(
      "@/features/entities/organizations/components/organization-create-workspace-layout"
    );

    renderToStaticMarkup(createElement(OrganizationCreateWorkspaceLayout));

    expect(renderOrganizationWorkspaceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Новая организация",
        subtitle: "Карточка организации",
        disabledTabs: ["accounts", "documents"],
      }),
    );
  });
});
