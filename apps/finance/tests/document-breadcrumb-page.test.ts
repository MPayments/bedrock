import React from "react";
import { describe, expect, it, vi } from "vitest";

const getCounterpartyById = vi.fn();
const getCurrencyById = vi.fn();
const getCustomerById = vi.fn();
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

describe("document breadcrumb page", () => {
  it("uses custom items for document details routes", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getDocumentDetails.mockResolvedValue({
      document: {
        docType: "invoice",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        docNo: "INV-001",
        title: "Invoice 001",
      },
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: [
          "documents",
          "commercial",
          "invoice",
          "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        ],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Документы",
        href: "/documents",
        icon: "book-open",
      },
      {
        label: "Инвойс",
        href: "/documents/commercial?docType=invoice",
      },
      {
        label: "INV-001",
        href: "/documents/commercial/invoice/614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
    ]);
  });
});
