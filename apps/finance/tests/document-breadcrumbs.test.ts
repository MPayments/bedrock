import { describe, expect, it } from "vitest";

import {
  buildDocumentDetailsBreadcrumbItems,
  buildDocumentCreateBreadcrumbItems,
  getDocumentDetailsBreadcrumbParams,
  resolveDocumentCreateBreadcrumbItems,
} from "@/features/documents/lib/breadcrumbs";

describe("document breadcrumbs", () => {
  it("builds create breadcrumbs in list-first order", () => {
    expect(buildDocumentCreateBreadcrumbItems("capital_funding")).toEqual([
      {
        label: "Документы",
        href: "/documents",
        icon: "book-open",
      },
      {
        label: "Капитальное финансирование",
        href: "/documents/ifrs?docType=capital_funding",
      },
      {
        label: "Новый документ",
      },
    ]);
  });

  it("resolves typed create breadcrumbs from catch-all segments", () => {
    expect(
      resolveDocumentCreateBreadcrumbItems([
        "documents",
        "create",
        "capital_funding",
      ]),
    ).toEqual(buildDocumentCreateBreadcrumbItems("capital_funding"));
  });

  it("builds details breadcrumbs in list-first order", () => {
    expect(
      buildDocumentDetailsBreadcrumbItems({
        docType: "invoice",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        docNo: "INV-001",
        title: "Invoice 001",
      }),
    ).toEqual([
      {
        label: "Документы",
        href: "/documents",
        icon: "book-open",
      },
      {
        label: "Счёт на оплату",
        href: "/documents/commercial?docType=invoice",
      },
      {
        label: "INV-001",
        href: "/documents/commercial/invoice/614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
    ]);
  });

  it("extracts params for details breadcrumbs from catch-all segments", () => {
    expect(
      getDocumentDetailsBreadcrumbParams([
        "documents",
        "commercial",
        "invoice",
        "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      ]),
    ).toEqual({
      docType: "invoice",
      id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    });
  });

  it("ignores unrelated breadcrumb segments", () => {
    expect(
      resolveDocumentCreateBreadcrumbItems([
        "documents",
        "ifrs",
        "capital_funding",
      ]),
    ).toBeNull();
    expect(
      getDocumentDetailsBreadcrumbParams([
        "documents",
        "create",
        "capital_funding",
      ]),
    ).toBeNull();
  });
});
