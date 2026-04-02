import React from "react";
import { describe, expect, it, vi } from "vitest";

const getCounterpartyById = vi.fn();
const getCurrencyById = vi.fn();
const getCustomerById = vi.fn();
const getFinanceDealWorkspaceById = vi.fn();
const getOrganizationById = vi.fn();
const getRequisiteProviderById = vi.fn();
const getRequisiteById = vi.fn();
const getUserById = vi.fn();
const getDocumentDetails = vi.fn();

vi.mock("@/features/entities/counterparties/lib/queries", () => ({
  getCounterpartyById,
}));

vi.mock("@/features/entities/currencies/lib/queries", () => ({
  getCurrencyById,
}));

vi.mock("@/features/entities/customers/lib/queries", () => ({
  getCustomerById,
}));

vi.mock("@/features/treasury/deals/lib/queries", () => ({
  getFinanceDealWorkspaceById,
}));

vi.mock("@/features/entities/organizations/lib/queries", () => ({
  getOrganizationById,
}));

vi.mock("@/features/entities/requisite-providers/lib/queries", () => ({
  getRequisiteProviderById,
}));

vi.mock("@/features/entities/requisites/lib/queries", () => ({
  getRequisiteById,
}));

vi.mock("@/app/(shell)/users/lib/queries", () => ({
  getUserById,
}));

vi.mock("@/features/operations/documents/lib/queries", () => ({
  getDocumentDetails,
}));

vi.mock("@/components/dynamic-breadcrumb", () => ({
  DynamicBreadcrumb: vi.fn(() => null),
}));

describe("treasury deals breadcrumb page", () => {
  it("builds a localized breadcrumb for deal workspaces", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getFinanceDealWorkspaceById.mockResolvedValue({
      summary: {
        applicantDisplayName: "ООО Ромашка",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        type: "exporter_settlement",
      },
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: [
          "treasury",
          "deals",
          "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        ],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Казначейство",
        href: "/treasury",
        icon: "landmark",
      },
      {
        label: "Сделки",
        href: "/treasury/deals",
        icon: "handshake",
      },
      {
        label: "Расчеты с экспортером • ООО Ромашка",
        href: "/treasury/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
    ]);
  });
});

