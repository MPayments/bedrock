import React from "react";
import { describe, expect, it, vi } from "vitest";

const getCounterpartyById = vi.fn();
const getCurrencyById = vi.fn();
const getCustomerById = vi.fn();
const getFinanceDealBreadcrumbById = vi.fn();
const getOrganizationById = vi.fn();
const getRequisiteProviderById = vi.fn();
const getRequisiteById = vi.fn();
const getTreasuryOperationById = vi.fn();
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
  getFinanceDealBreadcrumbById,
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

vi.mock("@/features/treasury/operations/lib/queries", () => ({
  getTreasuryOperationById,
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

    getFinanceDealBreadcrumbById.mockResolvedValue({
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
  }, 15_000);

  it("uses treasury canonical links for organization breadcrumbs", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getOrganizationById.mockResolvedValue({
      id: "org-1",
      shortName: "Bedrock Treasury",
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: ["treasury", "organizations", "org-1"],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Казначейство",
        href: "/treasury",
        icon: "landmark",
      },
      {
        label: "Организации",
        href: "/treasury/organizations",
        icon: "landmark",
      },
      {
        label: "Bedrock Treasury",
        href: "/treasury/organizations/org-1",
      },
    ]);
  });

  it("builds a localized breadcrumb for treasury operations", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getTreasuryOperationById.mockResolvedValue({
      dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      id: "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      kind: "payout",
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: [
          "treasury",
          "operations",
          "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
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
        label: "Операции",
        href: "/treasury/operations",
        icon: "workflow",
      },
      {
        label: "Выплата • #614FB6EB",
        href: "/treasury/operations/114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
    ]);
  });
});
