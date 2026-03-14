import { describe, expect, it } from "vitest";

import { buildDocumentCreateBreadcrumbItems } from "@/features/documents/lib/breadcrumbs";

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
});
