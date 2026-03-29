import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrganizationRequisitesForOrganization = vi.fn();
const parseOperationsSearchParams = vi.fn();
const getOperations = vi.fn();
const renderOperationsJournalTable = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children?: ReactNode;
    href:
      | string
      | { pathname?: string; query?: Record<string, string | undefined> };
  }) => {
    const resolvedHref =
      typeof href === "string"
        ? href
        : `${href.pathname ?? ""}${
            href.query
              ? `?${new URLSearchParams(
                  Object.entries(href.query).filter(
                    (entry): entry is [string, string] =>
                      typeof entry[1] === "string",
                  ),
                ).toString()}`
              : ""
          }`;

    return createElement("a", { ...props, href: resolvedHref }, children);
  },
}));

vi.mock("@/features/entities/organization-requisites/lib/queries", () => ({
  getOrganizationRequisitesForOrganization,
}));

vi.mock("@/features/operations/journal/lib/validations", () => ({
  searchParamsCache: {
    parse: parseOperationsSearchParams,
  },
}));

vi.mock("@/features/operations/journal/lib/queries", () => ({
  getOperations,
}));

vi.mock("@/features/operations/journal/components/operations-journal-table", () => ({
  OperationsJournalTable: (props: unknown) => {
    renderOperationsJournalTable(props);
    return null;
  },
}));

describe("organization detail pages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getOrganizationRequisitesForOrganization.mockResolvedValue([]);
    parseOperationsSearchParams.mockResolvedValue({
      page: 1,
      perPage: 10,
      dimensionFilters: {
        sourceOrganizationId: ["org-2"],
      },
    });
    getOperations.mockResolvedValue({
      data: [],
      total: 0,
      limit: 10,
      offset: 0,
    });
  });

  it("loads organization requisites and keeps create links scoped to the organization", async () => {
    const { default: OrganizationRequisitesPage } = await import(
      "@/app/(shell)/entities/organizations/[id]/requisites/page"
    );

    const html = renderToStaticMarkup(
      await OrganizationRequisitesPage({
        params: Promise.resolve({ id: "org-1" }),
      }),
    );

    expect(getOrganizationRequisitesForOrganization).toHaveBeenCalledWith("org-1");
    expect(html).toContain("/entities/requisites/create?ownerType=organization&amp;ownerId=org-1");
  });

  it("merges the organization filter into journal queries", async () => {
    const { default: OrganizationDocumentsPage } = await import(
      "@/app/(shell)/entities/organizations/[id]/documents/page"
    );

    const searchParams = Promise.resolve({
      "dimension.sourceOrganizationId": "org-2",
      status: "posted",
    });

    renderToStaticMarkup(
      await OrganizationDocumentsPage({
        params: Promise.resolve({ id: "org-1" }),
        searchParams,
      }),
    );

    expect(parseOperationsSearchParams).toHaveBeenCalledWith(searchParams);
    expect(getOperations).toHaveBeenCalledWith({
      page: 1,
      perPage: 10,
      dimensionFilters: {
        sourceOrganizationId: ["org-2"],
        organizationId: ["org-1"],
      },
    });
    expect(renderOperationsJournalTable).toHaveBeenCalledTimes(1);
  });
});
