import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrganizations = vi.fn();
const getFxQuotes = vi.fn();
const getRateSources = vi.fn();
const getTreasuryReferenceData = vi.fn();
const listExecutionInstructions = vi.fn();
const listTreasuryAccounts = vi.fn();
const listTreasuryOperations = vi.fn();
const listTreasuryPositions = vi.fn();
const listUnmatchedExternalRecords = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => React.createElement("a", { href }, children),
}));

vi.mock("@/components/data-table/skeleton", () => ({
  DataTableSkeleton: () => React.createElement("div", null, "data-table-skeleton"),
}));

vi.mock("@/components/entities/entity-list-page-shell", () => ({
  EntityListPageShell: ({
    actions,
    children,
    description,
    title,
  }: {
    actions?: React.ReactNode;
    children?: React.ReactNode;
    description?: string;
    title: string;
  }) =>
    React.createElement(
      "section",
      null,
      React.createElement("h1", null, title),
      React.createElement("p", null, description),
      React.createElement("div", null, actions),
      React.createElement("div", null, children),
    ),
}));

vi.mock("@/features/entities/organizations/lib/queries", () => ({
  getOrganizations,
}));

vi.mock("@/features/treasury/workbench/lib/reference-data", () => ({
  getTreasuryReferenceData,
}));

vi.mock("@/features/treasury/workbench/lib/queries", () => ({
  listExecutionInstructions,
  listTreasuryAccounts,
  listTreasuryOperations,
  listTreasuryPositions,
  listUnmatchedExternalRecords,
}));

vi.mock("@/features/treasury/quotes/lib/queries", () => ({
  getFxQuotes,
}));

vi.mock("@/features/treasury/rates/lib/queries", () => ({
  getRateSources,
}));

vi.mock("@/features/treasury/workbench/components/create-operation-form", () => ({
  TreasuryOperationCreateForm: () =>
    React.createElement("div", null, "create-operation-form"),
}));

vi.mock("@/features/treasury/workbench/components/operations-table", () => ({
  TreasuryOperationsTable: () => React.createElement("div", null, "operations-table"),
}));

vi.mock("@/features/treasury/workbench/components/positions-list", () => ({
  TreasuryPositionsList: () => React.createElement("div", null, "positions-list"),
}));

vi.mock("@/features/treasury/workbench/components/unmatched-records-list", () => ({
  TreasuryUnmatchedRecordsList: () => React.createElement("div", null, "unmatched-list"),
}));

const referenceData = {
  assetLabels: {
    "asset-usd": "USD",
    "asset-eur": "EUR",
  },
  counterpartyLabels: {},
  customerLabels: {},
  organizationLabels: {
    "org-1": "Multihansa",
  },
  providerLabels: {},
};

describe("treasury workspace pages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    listTreasuryAccounts.mockResolvedValue([
      {
        id: "account-1",
        assetId: "asset-usd",
        ownerEntityId: "org-1",
        operatorEntityId: "org-1",
        kind: "bank",
        accountReference: "main-usd",
        providerId: "provider-1",
        networkOrRail: null,
        canReceive: true,
        canSend: true,
        metadata: null,
      },
    ]);
    listTreasuryOperations.mockResolvedValue([]);
    listExecutionInstructions.mockResolvedValue([]);
    listUnmatchedExternalRecords.mockResolvedValue([]);
    listTreasuryPositions.mockResolvedValue([]);
    getOrganizations.mockResolvedValue({
      data: [{ id: "org-1", shortName: "Multihansa" }],
      total: 1,
      limit: 20,
      offset: 0,
    });
    getTreasuryReferenceData.mockResolvedValue(referenceData);
    getFxQuotes.mockResolvedValue({
      data: [
        {
          id: "quote-1",
          fromCurrency: "USD",
          toCurrency: "EUR",
          fromAmount: "1000",
          toAmount: "915",
          status: "active",
          createdAt: "2026-03-27T10:00:00.000Z",
        },
      ],
    });
    getRateSources.mockResolvedValue([
      { id: "source-1", isExpired: false },
      { id: "source-2", isExpired: true },
    ]);
  });

  it("renders treasury operations as the front door for payout and collection flows", async () => {
    const { default: TreasuryOperationsPage } = await import(
      "@/app/(shell)/treasury/operations/page"
    );

    const markup = renderToStaticMarkup(await TreasuryOperationsPage());

    expect(markup).toContain("Операции казначейства");
    expect(markup).toContain("Новая операция");
    expect(markup).toContain("/treasury/operations/create");
    expect(markup).not.toContain("Казначейский FX");
    expect(markup).toContain("operations-table");
    expect(listTreasuryAccounts).toHaveBeenCalled();
    expect(listTreasuryOperations).toHaveBeenCalledWith({ limit: 100 });
    expect(getTreasuryReferenceData).toHaveBeenCalled();
  });

  it("renders treasury operation create page as a non-fx route with an FX escape hatch", async () => {
    const { default: TreasuryOperationCreatePage } = await import(
      "@/app/(shell)/treasury/operations/create/page"
    );

    const markup = renderToStaticMarkup(await TreasuryOperationCreatePage());

    expect(markup).toContain("Новая операция казначейства");
    expect(markup).toContain("Создать");
    expect(markup).toContain("create-operation-form");
    expect(listTreasuryAccounts).toHaveBeenCalled();
    expect(getOrganizations).toHaveBeenCalledWith({ page: 1, perPage: 200 });
    expect(getTreasuryReferenceData).toHaveBeenCalled();
  });

  it("renders the treasury FX front door with launch and history entry points", async () => {
    const { default: TreasuryFxPage } = await import(
      "@/app/(shell)/treasury/fx/page"
    );

    const markup = renderToStaticMarkup(await TreasuryFxPage());

    expect(markup).toContain("Казначейский FX");
    expect(markup).toContain("Создать FX");
    expect(markup).toContain("Журнал FX-документов");
    expect(markup).toContain("Когда нужен FX");
    expect(getFxQuotes).toHaveBeenCalledWith({ page: 1, perPage: 5 });
    expect(getRateSources).toHaveBeenCalled();
  });

  it("renders treasury positions as a settlement workspace", async () => {
    const { default: TreasuryPositionsPage } = await import(
      "@/app/(shell)/treasury/positions/page"
    );

    const markup = renderToStaticMarkup(await TreasuryPositionsPage());

    expect(markup).toContain("Позиции казначейства");
    expect(markup).toContain("positions-list");
    expect(listTreasuryPositions).toHaveBeenCalled();
    expect(getTreasuryReferenceData).toHaveBeenCalled();
  });

  it("renders treasury exceptions with execution matching context", async () => {
    const { default: TreasuryUnmatchedPage } = await import(
      "@/app/(shell)/treasury/unmatched/page"
    );

    const markup = renderToStaticMarkup(await TreasuryUnmatchedPage());

    expect(markup).toContain("Исключения исполнения");
    expect(markup).toContain("unmatched-list");
    expect(listExecutionInstructions).toHaveBeenCalledWith({ limit: 200 });
    expect(listTreasuryOperations).toHaveBeenCalledWith({ limit: 200 });
    expect(listUnmatchedExternalRecords).toHaveBeenCalledWith({ limit: 100 });
    expect(getTreasuryReferenceData).toHaveBeenCalled();
  });
});
