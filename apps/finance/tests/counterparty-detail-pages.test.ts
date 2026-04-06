import React, { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("counterparty detail pages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.assign(globalThis, { React });

    parseOperationsSearchParams.mockResolvedValue({
      page: 1,
      perPage: 10,
      dimensionFilters: {
        counterpartyId: ["counterparty-2"],
      },
    });
    getOperations.mockResolvedValue({
      data: [],
      total: 0,
      limit: 10,
      offset: 0,
    });
  });

  it("merges the counterparty filter into journal queries", async () => {
    const { default: CounterpartyDocumentsPage } = await import(
      "@/app/(shell)/entities/counterparties/[id]/documents/page"
    );

    const searchParams = Promise.resolve({
      "dimension.counterpartyId": "counterparty-2",
      status: "posted",
    });

    const html = renderToStaticMarkup(
      await CounterpartyDocumentsPage({
        params: Promise.resolve({ id: "counterparty-1" }),
        searchParams,
      }),
    );

    expect(parseOperationsSearchParams).toHaveBeenCalledWith(searchParams);
    expect(getOperations).toHaveBeenCalledWith({
      page: 1,
      perPage: 10,
      dimensionFilters: {
        counterpartyId: ["counterparty-2", "counterparty-1"],
      },
    });
    expect(renderOperationsJournalTable).toHaveBeenCalledTimes(1);
    expect(html).toContain("dimension.counterpartyId=counterparty-1");
  });

  it("shows an inline error state when the journal query fails", async () => {
    const { ApiRequestError } = await import("@/lib/api/response");

    getOperations.mockRejectedValueOnce(
      new ApiRequestError(
        "Ошибка сервера. Попробуйте позже.",
        500,
        { error: "Internal server error" },
      ),
    );

    const { default: CounterpartyDocumentsPage } = await import(
      "@/app/(shell)/entities/counterparties/[id]/documents/page"
    );

    const html = renderToStaticMarkup(
      await CounterpartyDocumentsPage({
        params: Promise.resolve({ id: "counterparty-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(renderOperationsJournalTable).not.toHaveBeenCalled();
    expect(html).toContain("Не удалось загрузить журнал операций по контрагенту.");
    expect(html).toContain("Ошибка сервера. Попробуйте позже.");
  });
});
